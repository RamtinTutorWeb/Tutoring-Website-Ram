import { BrowserRouter } from "react-router-dom";
import { ContentProvider } from "./api/ContentProvider";
import { MeProvider } from "./api/MeProvider";
import { AuthProvider } from "./auth/session";
import AppShell from "./layout/AppShell";

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <MeProvider>
          <ContentProvider>
            <AppShell />
          </ContentProvider>
        </MeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
