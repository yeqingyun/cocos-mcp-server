# coding=utf-8
"""
Web Search + Content Fetch Skill
Supports two modes:
  search  — search the web and return ranked results (default)
  fetch   — fetch a specific URL and extract its main text content
  full    — search first, then fetch the top result's page content
"""
import requests
import json
import argparse
import sys
import io
import re
from html.parser import HTMLParser
from urllib.parse import quote_plus

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# ---------------------------------------------------------------------------
# LangSearch API config
# ---------------------------------------------------------------------------
LANGSEARCH_API = "https://api.langsearch.com/v1/web-search"
LANGSEARCH_KEY = "sk-0df7fa57cb5d45d3b864eb57a6400081"

# ---------------------------------------------------------------------------
# HTML → plain text extractor
# ---------------------------------------------------------------------------
class _TextExtractor(HTMLParser):
    """Extract visible text from HTML, skipping script/style/nav/footer."""
    SKIP_TAGS = frozenset(('script', 'style', 'noscript', 'nav', 'footer', 'header', 'svg', 'form', 'iframe'))

    def __init__(self):
        super().__init__()
        self._pieces: list[str] = []
        self._skip_depth = 0
        self._tag_stack: list[str] = []

    def handle_starttag(self, tag, attrs):
        self._tag_stack.append(tag)
        if tag in self.SKIP_TAGS:
            self._skip_depth += 1
        if tag in ('h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'tr', 'br', 'div'):
            self._pieces.append('\n')

    def handle_endtag(self, tag):
        if self._tag_stack and self._tag_stack[-1] == tag:
            self._tag_stack.pop()
        if tag in self.SKIP_TAGS and self._skip_depth > 0:
            self._skip_depth -= 1
        if tag in ('h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'tr', 'div', 'section', 'article'):
            self._pieces.append('\n')

    def handle_data(self, data):
        if self._skip_depth == 0:
            self._pieces.append(data)

    def get_text(self) -> str:
        raw = ''.join(self._pieces)
        # collapse multiple blank lines
        lines = [l.strip() for l in raw.splitlines()]
        cleaned = '\n'.join(l for l in lines if l)
        # remove excessive newlines (max 2)
        cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
        return cleaned


def html_to_text(html: str) -> str:
    p = _TextExtractor()
    try:
        p.feed(html)
    except Exception:
        pass
    return p.get_text()


# ---------------------------------------------------------------------------
# Mode: search
# ---------------------------------------------------------------------------
def do_search(query: str, freshness: str, count: int, summary: bool) -> dict:
    payload = json.dumps({
        "query": query,
        "freshness": freshness,
        "summary": summary,
        "count": count,
    })
    headers = {
        'Authorization': LANGSEARCH_KEY,
        'Content-Type': 'application/json',
    }
    resp = requests.post(LANGSEARCH_API, headers=headers, data=payload, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    results = []
    web_pages = data.get("data", {}).get("webPages", {}).get("value", [])
    for item in web_pages:
        results.append({
            "title": item.get("name", ""),
            "url": item.get("url", ""),
            "snippet": item.get("snippet", ""),
            "summary": item.get("summary", ""),
        })
    return {"mode": "search", "query": query, "results": results}


# ---------------------------------------------------------------------------
# Mode: fetch  (retrieve a URL and extract text)
# ---------------------------------------------------------------------------
def do_fetch(url: str, max_chars: int = 8000) -> dict:
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                       '(KHTML, like Gecko) Chrome/125.0 Safari/537.36',
    }
    try:
        resp = requests.get(url, headers=headers, timeout=20)
        resp.raise_for_status()
        resp.encoding = resp.apparent_encoding or 'utf-8'
        text = html_to_text(resp.text)
        if len(text) > max_chars:
            text = text[:max_chars] + f"\n\n... [truncated, total {len(text)} chars]"
        return {"mode": "fetch", "url": url, "content": text, "success": True}
    except Exception as e:
        return {"mode": "fetch", "url": url, "content": "", "success": False, "error": str(e)}


# ---------------------------------------------------------------------------
# Mode: full  (search + fetch top result)
# ---------------------------------------------------------------------------
def do_full(query: str, freshness: str, count: int, fetch_top: int = 1, max_chars: int = 8000) -> dict:
    search_result = do_search(query, freshness, count, summary=True)
    fetched = []
    for item in search_result["results"][:fetch_top]:
        f = do_fetch(item["url"], max_chars)
        fetched.append({"title": item["title"], "url": item["url"], "page_content": f["content"]})
    return {"mode": "full", "query": query, "search_results": search_result["results"], "fetched_pages": fetched}


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description='Web Search & Fetch Skill')
    parser.add_argument('--query', '-q', default='', help='Search query (for search/full mode)')
    parser.add_argument('--url', '-u', default='', help='URL to fetch (for fetch mode)')
    parser.add_argument('--mode', '-m', default='search',
                        choices=['search', 'fetch', 'full'],
                        help='Mode: search (default), fetch (grab a URL), full (search + fetch top results)')
    parser.add_argument('--freshness', '-f', default='noLimit',
                        help='Time filter: oneDay/oneWeek/oneMonth/oneYear/noLimit')
    parser.add_argument('--count', '-c', type=int, default=10, help='Number of search results (1-10)')
    parser.add_argument('--fetch-top', '-t', type=int, default=1,
                        help='In full mode, how many top results to fetch page content (1-3)')
    parser.add_argument('--max-chars', type=int, default=8000,
                        help='Max characters to extract from a fetched page')
    parser.add_argument('--summary', '-s', action='store_true', default=True,
                        help='Include summary in search results')

    args = parser.parse_args()

    if args.mode == 'fetch':
        if not args.url:
            print(json.dumps({"error": "--url is required in fetch mode"}, ensure_ascii=False))
            sys.exit(1)
        result = do_fetch(args.url, args.max_chars)
    elif args.mode == 'full':
        if not args.query:
            print(json.dumps({"error": "--query is required in full mode"}, ensure_ascii=False))
            sys.exit(1)
        result = do_full(args.query, args.freshness, args.count, args.fetch_top, args.max_chars)
    else:
        if not args.query:
            print(json.dumps({"error": "--query is required in search mode"}, ensure_ascii=False))
            sys.exit(1)
        result = do_search(args.query, args.freshness, args.count, args.summary)

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
