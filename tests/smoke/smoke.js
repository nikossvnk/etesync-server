// Checks a running test server the way a client uses it, with the real Etebase client.
// It needs a server that allows signing up, like the test-server image:
//   npm install --prefix tests/smoke && node tests/smoke/smoke.js http://127.0.0.1:3735
const Etebase = require("etebase");

const serverUrl = process.argv[2] || "http://127.0.0.1:3735";
const colType = "smoke.test";

function check(what, condition) {
  if (!condition) {
    throw new Error(`Check failed: ${what}`);
  }
  console.log(`ok - ${what}`);
}

async function rejects(what, error, promise) {
  try {
    await promise;
  } catch (e) {
    // Without an error to expect any error will do
    check(what, !error || (e instanceof error));
    return;
  }
  throw new Error(`Check failed: ${what} (it was not rejected)`);
}

(async () => {
  const username = `smoke${Date.now()}`;
  const password = "a password for the smoke test";

  const signedUp = await Etebase.Account.signup({ username, email: `${username}@example.com` }, password, serverUrl);
  check("sign up", signedUp.user.username === username);
  await signedUp.logout();

  await rejects("log in with a wrong password is rejected", Etebase.UnauthorizedError,
    Etebase.Account.login(username, "not the password", serverUrl));

  const etebase = await Etebase.Account.login(username, password, serverUrl);
  check("log in", etebase.user.username === username);

  const colMgr = etebase.getCollectionManager();
  const col = await colMgr.create(colType, { name: "Smoke test" }, "");
  await colMgr.upload(col);
  const collections = await colMgr.list(colType);
  check("create and list a collection", collections.data.some((x) => x.uid === col.uid));
  const fetchedCol = await colMgr.fetch(col.uid);
  check("fetch a collection", fetchedCol.getMeta().name === "Smoke test");

  const itemMgr = colMgr.getItemManager(col);
  const item = await itemMgr.create({ name: "An item" }, "first");
  await itemMgr.batch([item]);
  let items = await itemMgr.list();
  check("create and list an item", (items.data.length === 1) && (items.data[0].uid === item.uid));
  check("the content of the item", (await items.data[0].getContent(Etebase.OutputFormat.String)) === "first");

  // Change it in two places, the second change has to be detected as a conflict
  const stale = itemMgr.cacheLoad(itemMgr.cacheSave(item));
  await item.setContent("second");
  await itemMgr.transaction([item]);
  const fetched = await itemMgr.fetch(item.uid);
  check("change an item", (await fetched.getContent(Etebase.OutputFormat.String)) === "second");
  await stale.setContent("conflicting");
  await rejects("a conflicting change is rejected", Etebase.ConflictError, itemMgr.transaction([stale]));

  const changes = await itemMgr.list({ stoken: items.stoken });
  check("list the changes since a sync token", (changes.data.length === 1) && (changes.stoken !== items.stoken));

  const revisions = await itemMgr.itemRevisions(item);
  check("list the revisions of an item", revisions.data.length === 2);

  item.delete();
  await itemMgr.batch([item]);
  items = await itemMgr.list();
  check("delete an item", items.data[0].isDeleted);

  // Requests that used to make the server fail with an internal error
  const api = `${serverUrl}/api/v1`;
  const status = async (path, options) => (await fetch(api + path, options)).status;
  check("a malformed Authorization header is rejected",
    (await status(`/collection/${col.uid}/item/`, { headers: { Authorization: "Token" } })) === 401);
  for (const uid of ["..", "....", "..AAAAAAAAAAAAAAAAAAAAAAAAAA", "A".repeat(61)]) {
    const code = await status(`/collection/${col.uid}/item/${item.uid}/chunk/${uid}/`, {
      method: "PUT",
      headers: { Authorization: `Token ${etebase.authToken}`, "Content-Type": "application/octet-stream" },
      body: "x",
    });
    check(`a chunk with the uid ${JSON.stringify(uid.slice(0, 30))} is rejected`, (code === 400) || (code === 404));
  }

  const validChunk = await status(`/collection/${col.uid}/item/${item.uid}/chunk/${"C".repeat(43)}/`, {
    method: "PUT",
    headers: { Authorization: `Token ${etebase.authToken}`, "Content-Type": "application/octet-stream" },
    body: "x",
  });
  check("a chunk with a valid uid is accepted", validChunk === 201);

  // Other sites may use the API, but not the admin site
  const origin = "https://other.example";
  const preflight = await fetch(`${api}/collection/list_multi/`, {
    method: "OPTIONS",
    headers: { Origin: origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization" },
  });
  check("other sites may use the API", preflight.headers.get("access-control-allow-origin") === origin);
  const admin = await fetch(`${serverUrl}/admin/login/`, { headers: { Origin: origin } });
  check("other sites may not use the admin site", admin.headers.get("access-control-allow-origin") === null);

  const members = await colMgr.getMemberManager(col).list();
  check("list the members of a collection", (members.data.length === 1) && (members.data[0].username === username));

  const invitations = await etebase.getInvitationManager().listIncoming();
  check("list the invitations", invitations.data.length === 0);

  await etebase.fetchToken();
  check("refresh the login token", true);

  await etebase.logout();
  await rejects("requests after logging out are rejected", undefined, colMgr.list(colType));

  console.log("All checks passed");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
