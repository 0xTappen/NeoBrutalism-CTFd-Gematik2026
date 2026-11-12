# Gematik 2026 CTFd Theme

A Neo Brutalism frontend theme for Jeopardy-style CTFd competitions. The theme preserves CTFd's standard workflows and API endpoints while providing a responsive competition interface, light and dark modes, challenge filters, scoreboard visualizations, and consistent account pages.

## Features

- Responsive Neo Brutalism interface
- Scrolling competition category ticker with reduced-motion support
- Light and dark modes with persistent preferences
- Desktop and mobile navigation
- Language selector connected to CTFd language settings
- Challenge filtering by category and solve status
- Challenge search and sorting
- Challenge modal with descriptions, hints, files, and flag submission
- Solved and first-blood challenge states
- Score progression charts powered by ECharts
- Top-three podium and solve matrix on the scoreboard
- User and team profile pages
- Themed dropdowns with country search
- Landing-page timeline and countdown for 21 November 2026, 09.00–19.00 WIB
- Lightweight animations with `prefers-reduced-motion` support

## Requirements

- A working CTFd installation
- Node.js 18 or newer
- npm
- Git

The theme is built with Bootstrap 4, Sass, Webpack, and ECharts.

## Installation

Open the themes directory of your CTFd installation:

```bash
cd CTFd/themes
git clone https://github.com/0xTappen/NeoBrutalism-CTFd-Gematik2026.git Gematik2026
cd Gematik2026
npm install
npm run build
```

Keeping the theme directory named `Gematik2026` is recommended because it matches the configuration and deployment examples in this documentation.

Enable the theme from the CTFd admin panel after the build finishes:

1. Sign in as an administrator.
2. Open `Admin Panel`.
3. Navigate to `Config`, then `Theme`.
4. Select `Gematik2026`.
5. Save the configuration.

Restart the CTFd process and perform a hard refresh if the theme does not appear immediately.

## Installation with Docker Compose

The following example assumes that the CTFd repository and theme repository share the same parent directory:

```text
workspace/
├── CTFd-Main/
└── NeoBrutalism-CTFd-Gematik2026/
```

Build the theme, copy it into the CTFd installation, and restart the container:

```bash
cd NeoBrutalism-CTFd-Gematik2026
npm install
npm run build

mkdir -p ../CTFd-Main/CTFd/themes/Gematik2026
cp -r assets templates static package.json package-lock.json webpack.config.js \
  ../CTFd-Main/CTFd/themes/Gematik2026/

docker compose -f ../CTFd-Main/docker-compose.yml restart ctfd
```

For development, you can clone the theme directly into `CTFd-Main/CTFd/themes/Gematik2026` so that copying is not required.

## Installation with CTFd++

This theme supports [MoreMorePwn/CTFdPlusPlus](https://github.com/MoreMorePwn/CTFdPlusPlus). CTFd++ is a full CTFd fork, so use it as the CTFd application and install this repository as a theme inside that application:

```bash
git clone https://github.com/MoreMorePwn/CTFdPlusPlus.git CTFdPlusPlus
cd CTFdPlusPlus/CTFd/themes
git clone https://github.com/0xTappen/NeoBrutalism-CTFd-Gematik2026.git Gematik2026
cd Gematik2026
npm install
npm run build
```

Start CTFd++ from its repository root:

```bash
cd ../../../
./run.sh start
```

Then open the admin panel, go to `Config` -> `Theme`, select `Gematik2026`, and save.

### CTFd++ compatibility

The challenge modal includes optional CTFd++ submission metadata fields:

- `AI Source` links are submitted as `ai_source`.
- `Solver / Script` uploads are submitted as multipart `solver` files.
- A local `ctfd_browser_fingerprint` value is sent with metadata submissions for CTFd++ anti-cheat review.
- User-facing CTFd++ tickets from `/api/v1/tickets/pending` are shown as Neo Brutalism alerts/toasts.

These additions are optional. On standard CTFd, leaving `AI Source` and `Solver / Script` empty keeps the normal JSON challenge submission flow.

## Development

Source files are stored in `assets/` and `templates/`.

```text
assets/
├── css/
│   ├── main.scss
│   └── neo/
└── js/
    ├── components/
    └── pages/
templates/
static/
webpack.config.js
```

Do not edit generated files inside `static/` manually. Make CSS and JavaScript changes inside `assets/`, then rebuild the theme:

```bash
npm run build
```

Webpack generates filenames that match the way CTFd resolves theme assets:

```text
static/css/main.min.css
static/js/pages/main.min.js
static/js/pages/challenges.min.js
static/js/pages/scoreboard.min.js
```

If the theme repository is outside the CTFd directory, use the following workflow after changing JavaScript, SCSS, or templates:

```bash
npm run build
cp -r static/* ../CTFd-Main/CTFd/themes/Gematik2026/static/
cp -r templates/* ../CTFd-Main/CTFd/themes/Gematik2026/templates/
docker compose -f ../CTFd-Main/docker-compose.yml restart ctfd
```

## Competition Configuration

### Schedule and countdown

The landing-page timeline and countdown use 21 November 2026, 09.00–19.00 WIB. The page automatically displays one of the following states:

- A countdown before the event starts
- Main event while the competition is running
- Event ended after the competition finishes

Set the same start and end times separately in the CTFd admin panel to control actual challenge availability and competition behavior. The theme schedule only controls the landing-page display.

### Challenge categories

Categories are not hardcoded in the theme. Challenge filters and the solve matrix are generated automatically from challenges published through the admin panel. Example categories include:

- Web
- Binary Exploitation
- Reverse Engineering
- Cryptography
- Forensics
- Geosint
- Miscellaneous

### Challenge and scoreboard visibility

CTFd controls whether unauthenticated visitors can view challenges and scores. Check the visibility and authentication settings in the admin panel if challenges are not visible to public visitors.

### Database-backed home page

CTFd can store the `/` page in its database. That page may take priority over `templates/index.html`. If the theme landing page does not appear, remove or disable the `/` page from the CTFd admin panel and restart the application.

## Troubleshooting

### The interface does not change after a build

Make sure the generated assets have been copied into the theme directory used by CTFd:

```bash
npm run build
cp -r static/* ../CTFd-Main/CTFd/themes/Gematik2026/static/
cp -r templates/* ../CTFd-Main/CTFd/themes/Gematik2026/templates/
```

Restart CTFd and perform a hard refresh:

```bash
docker compose -f ../CTFd-Main/docker-compose.yml restart ctfd
```

### JavaScript or CSS does not load

Open the browser Network panel and confirm that the following files return status `200`:

```text
/themes/Gematik2026/static/css/main.min.css
/themes/Gematik2026/static/js/pages/main.min.js
```

CTFd resolves theme assets using `.min.js` and `.min.css` suffixes. Do not change the output pattern in `webpack.config.js` unless the CTFd theme loader is updated accordingly.

### A dropdown or modal still shows an older version

Clear the browser cache, perform a hard refresh, and confirm that the latest templates and JavaScript bundles were copied. Purge cached theme assets when using a reverse proxy or CDN.

### The scoreboard or challenge board is empty

Check the following conditions:

- Challenges have been published
- The event is currently accessible
- Scoreboard visibility is enabled
- The visitor meets the login or team requirements
- The reverse proxy does not block CTFd API endpoints

## Adding a New Remote Repository

If the local repository does not have a remote:

```bash
git remote add origin https://github.com/USERNAME/NeoBrutalism-CTFd-Gematik2026.git
git branch -M master
git push -u origin master
```

Replace `USERNAME` with your GitHub username or organization.

## License

This project is released under the [MIT License](LICENSE). Third-party dependencies remain subject to their respective licenses.
# NeoBrutalism-CTFd-Gematik2026
