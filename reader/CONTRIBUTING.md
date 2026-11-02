# Contributing to versum-reader

Thank you. The reader is Versum's own analyzer readers, so a fix here is a fix for every card in Versum's catalogue.

## Ground rules

- **Fixtures are synthetic.** Write the HTML by hand for a business that does not exist (`example` in every
  domain, 555 phone numbers, Gmail-style mailboxes on made-up names). Never commit a copy of a real business's page.
- **Nothing invented.** Every value the reader returns must come from the page, with its words in `evidence`.
  A reader that cannot tell returns `null` and says why in `notes`.
- **Polite reading only.** robots.txt is obeyed, one request per host per second, no logins, no captcha solving,
  no proxy, no browser.
- English in code, comments and docs. Words of other languages belong in the page-words data.
- No keys, tokens or addresses of anyone's servers in code, tests or fixtures.

## Add …

- **A platform** (a site builder, an ordering or booking system): a signal in the analyzer's platform detector or
  the family's platform list, the host in the platform registry (`data/platforms.json` is a snapshot of it), and a
  fixture + test showing the door it produces.
- **An adapter** (a new catalogue or menu format): a pure function from HTML/JSON to items, next to the existing
  adapters, with a fixture and a test. Pure means no network inside; the reader fetches.
- **Page words** (how a menu, booking or price page is called in a language): add rows to the page-words data
  (`kind`, `lang`, `word`, `mode`), with an example page title in the PR description.
- **A recipe** (a path on a host that our reader reads reliably): recipes are enabled only after Versum's pilot has
  checked them on many businesses; propose one with three public example URLs in an issue.

## Workflow

```sh
npm install && npm run build && npm test
```

Open a pull request with: what changed, the fixture, the test output, and for a platform or recipe, public example
URLs (they are not committed).
