// Every request to the ALink backend says which caller sent it. The channel app
// (web, iOS, Android and the iOS share extension) always sends "client".
const REQUESTER_HEADERS = { "Alink-Requester": "client" } as const;

export { REQUESTER_HEADERS };
