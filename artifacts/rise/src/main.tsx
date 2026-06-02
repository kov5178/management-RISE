import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const RESIZE_OBSERVER_ERRORS = [
  "ResizeObserver loop limit exceeded",
  "ResizeObserver loop completed with undelivered notifications",
];

const isResizeObserverError = (value: unknown): boolean => {
  if (typeof value === "string") {
    return RESIZE_OBSERVER_ERRORS.some((msg) => value.includes(msg));
  }
  if (value && typeof value === "object" && "message" in value) {
    const message = (value as { message?: unknown }).message;
    return typeof message === "string" &&
      RESIZE_OBSERVER_ERRORS.some((msg) => message.includes(msg));
  }
  return false;
};

window.addEventListener("error", (event) => {
  if (isResizeObserverError(event.message) || isResizeObserverError(event.error)) {
    event.stopImmediatePropagation();
    event.preventDefault();
  }
});

window.addEventListener("unhandledrejection", (event) => {
  if (isResizeObserverError(event.reason)) {
    event.stopImmediatePropagation();
    event.preventDefault();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
