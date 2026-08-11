import Header from "./Header";
import Footer from "./Footer";
import AppRouter from "../router/AppRouter";

export default function AppShell() {
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
