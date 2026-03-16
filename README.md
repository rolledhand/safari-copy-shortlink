# Safari Copy Shortlink

Inspired by Arc's `Cmd + Shift + C` shortcut, Safari Copy Shortlink brings the same quick copy-current-page workflow to Safari, but copies a cleaned URL instead of the raw one.

![Safari Copy Shortlink toast](assets/toastimage.png)

Built as a Raycast extension, it requires [Raycast](https://www.raycast.com/) to run.

## What it does

- Copies the current Safari tab URL
- Removes common tracking parameters and junk
- Returns a cleaner, more shareable link
- Runs as a Raycast command: `Copy Clean Safari URL`

## How it behaves

- Safari must be frontmost
- If Safari is not frontmost, the command does nothing
- If Safari is frontmost but there is no real page to copy, it shows `No page to copy`
- If a valid page exists, it copies the cleaned URL and shows `Copied clean URL`

## Installation

1. Import or open the extension in Raycast
2. Install dependencies with `npm install`
3. Start it with `npm run dev`
4. Assign a shortcut of your choice to `Copy Clean Safari URL` in Raycast
5. Pick a shortcut that does not conflict with your browser if you want a Safari-only setup

## Usage

1. Open a page in Safari
2. Make sure Safari is the frontmost app
3. Trigger `Copy Clean Safari URL`
4. Paste the cleaned URL anywhere

## Shortcut setup

Raycast command hotkeys are global. If Raycast owns `Cmd + Shift + C`, Arc will not receive that shortcut.

For a Safari-only setup:

- Assign any shortcut you prefer in Raycast
- Avoid using a shortcut that you also want Arc to keep handling

For using the same shortcut in Safari and Arc:

- Do not assign that shared shortcut directly in Raycast
- Keep Arc's own shortcut in Arc
- Use a different shortcut for this Copy Shortlink functionality

## Examples

```text
https://example.com/article?utm_source=twitter&utm_medium=social
-> https://example.com/article

https://www.google.com/url?q=https%3A%2F%2Fexample.com%2Fpost%3Futm_campaign%3Dspring&sa=D
-> https://example.com/post

https://www.youtube.com/watch?v=dQw4w9WgXcQ&si=abc123&t=43
-> https://youtu.be/dQw4w9WgXcQ?t=43

https://music.youtube.com/watch?v=abc123&si=xyz
-> https://music.youtube.com/watch?v=abc123

https://www.amazon.com/Anything-Here/dp/B08N5WRWNW/ref=something
-> https://www.amazon.com/dp/B08N5WRWNW
```

## Limitations

- The cleaner is rule-based, not universal
- Safari has to be frontmost by design
- Some redirect and short-link formats cannot be fully resolved
- Raycast may need Automation permission for `System Events` and `Safari`
- Raycast hotkeys are global, so sharing the same shortcut with Arc requires an app-aware external trigger

## Development

- Built with TypeScript, `@raycast/api`, and `runAppleScript` from `@raycast/utils`
- Main command file: `src/copy-clean-safari-url.ts`
- Useful commands: `npm install`, `npm run dev`, `npm run build`

## License

MIT
