import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import { App } from "./App";
import "@fontsource-variable/plus-jakarta-sans";
import "./fonts.css";
import "./styles.css";

// The single-file build is often opened from disk (file://), where path-based routing is not allowed.
const Router = __STANDALONE__ ? HashRouter : BrowserRouter;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Router>
      <App />
    </Router>
  </StrictMode>,
);
