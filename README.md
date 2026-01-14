

# YouTube Video Length Sorter

A minimal Node.js app that fetches all public videos from a YouTube channel, sorts them by duration, and displays them in a responsive, bento-style grid with thumbnails and video length.

---

## Features

* Fetch all **public videos** of a channel using the YouTube Data API.
* Sort videos **descending by duration**.
* Responsive **bento-style grid** with large thumbnails.
* Duration displayed in **hours + minutes**.
* Loading spinner and zero-duration filtering.
* Minimal frontend with **Tailwind CSS** and **Inter font**.

---

## Requirements

* Node.js ≥ 18
* YouTube Data API Key

---

## Setup

1. Clone the repo:

```bash
git clone <repo-url>
cd youtube-api
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file:

```env
YOUTUBE_API_KEY=YOUR_API_KEY_HERE
PORT=3000
```

---

## Run

```bash
node server.js
```

Open in browser:

```
http://localhost:3000
```

---

## Usage

1. Paste a YouTube channel URL in the input (supports `@handle` or `/channel/<ID>`).
2. Click **Fetch**.
3. Videos appear in a responsive grid, sorted by duration.

---

## Notes

* Only **public videos** are fetched; unlisted/private videos require **OAuth**.
* For channels with many videos, consider implementing **pagination** to improve performance.

---

## License

MIT License
