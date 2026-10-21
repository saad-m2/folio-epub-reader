import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import "./style.css";
import "./app.css";
import "./reader.css";
if (new URLSearchParams(window.location.search).has("release-test"))
  void import("./release-tests");
createRoot(document.getElementById("root")!).render(<App />);
