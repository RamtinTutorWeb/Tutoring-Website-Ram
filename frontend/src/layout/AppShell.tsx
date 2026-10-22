import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import AppRouter from "../router/AppRouter";

/** New page -> top of the window; `#section` links scroll to their target instead. */
function useScrollRestore() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
}

export default function AppShell() {
  useScrollRestore();
  return (
    <div className="app-shell">
      <Header />
      <main className="container app-main" id="app">
        <AppRouter />
      </main>
      <Footer />
    </div>
  );
}
