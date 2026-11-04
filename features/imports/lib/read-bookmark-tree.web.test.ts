/**
 * @jest-environment jsdom
 */
import { parseBookmarkHtml } from "./read-bookmark-tree.web";

const CHROME = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1700000000" LAST_MODIFIED="0" PERSONAL_TOOLBAR_FOLDER="true">북마크바</H3>
    <DL><p>
        <DT><A HREF="https://bar.example.com/" ADD_DATE="1700000100" ICON="data:image/png;base64,AAAA">바로 아래</A>
        <DT><H3 ADD_DATE="1600000000" LAST_MODIFIED="1600000000">공부</H3>
        <DL><p>
            <DT><H3 ADD_DATE="1600000001">자바</H3>
            <DL><p>
                <DT><A HREF="https://java.example.com/21" ADD_DATE="1600000002">Java 21</A>
            </DL><p>
            <DT><A HREF="https://study.example.com" ADD_DATE="1600000003">공부 링크</A>
        </DL><p>
    </DL><p>
    <DT><H3 ADD_DATE="1700000200">기타 북마크</H3>
    <DL><p>
        <DT><A HREF="https://other.example.com">기타</A>
    </DL><p>
    <DT><A HREF="https://top.example.com">최상위</A>
</DL><p>`;

describe("parseBookmarkHtml", () => {
  it("reads folders, links, dates and the bookmark bar from a browser export", () => {
    const result = parseBookmarkHtml(CHROME);
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") {
      return;
    }
    expect(result.tree.children).toEqual([
      {
        type: "folder",
        name: "북마크바",
        addDate: "1700000000",
        isToolbar: true,
        children: [
          {
            type: "link",
            title: "바로 아래",
            url: "https://bar.example.com/",
            addDate: "1700000100",
          },
          {
            type: "folder",
            name: "공부",
            addDate: "1600000000",
            isToolbar: false,
            children: [
              {
                type: "folder",
                name: "자바",
                addDate: "1600000001",
                isToolbar: false,
                children: [
                  {
                    type: "link",
                    title: "Java 21",
                    url: "https://java.example.com/21",
                    addDate: "1600000002",
                  },
                ],
              },
              {
                type: "link",
                title: "공부 링크",
                url: "https://study.example.com",
                addDate: "1600000003",
              },
            ],
          },
        ],
      },
      {
        type: "folder",
        name: "기타 북마크",
        addDate: "1700000200",
        isToolbar: false,
        children: [
          { type: "link", title: "기타", url: "https://other.example.com", addDate: null },
        ],
      },
      { type: "link", title: "최상위", url: "https://top.example.com", addDate: null },
    ]);
  });

  it("reads an empty export as a bookmark file with nothing in it", () => {
    const result = parseBookmarkHtml(
      "<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n</DL><p>",
    );
    expect(result).toEqual({ kind: "ok", tree: { children: [] } });
  });

  it("rejects an HTML page that is not a bookmark export", () => {
    expect(
      parseBookmarkHtml("<!doctype html><html><body><h1>Hello</h1><p>page</p></body></html>"),
    ).toEqual({ kind: "not-bookmark" });
    expect(parseBookmarkHtml("<!doctype html><dl><dt>Term</dt><dd>Definition</dd></dl>")).toEqual({
      kind: "not-bookmark",
    });
  });
});
