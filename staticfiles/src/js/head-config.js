const DEFAULT_TITLE = "CPSU Document Tracker";
const FAVICON_PATH = "/src/images/cpsulogo.png";

document.title = DEFAULT_TITLE;

let faviconLink = document.querySelector("link[rel='icon']");

if (!faviconLink) {
  faviconLink = document.createElement("link");
  faviconLink.setAttribute("rel", "icon");
  document.head.appendChild(faviconLink);
}

faviconLink.setAttribute("type", "image/png");
faviconLink.setAttribute("href", FAVICON_PATH);
