import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import AndroidThemeProvider from "./components/AndroidThemeProvider";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider>
    <AndroidThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                <Route path="/auth" element={<Navigate to="/" replace />} />
                <Route path="/" element={<Index />} />
                <Route path="/dms" element={<Index />} />
                <Route path="/dm/:userId" element={<Index />} />
                <Route path="/admin" element={<Index />} />
                <Route path="/chat-info" element={<Index />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </BrowserRouter_PLACEHOLDER>
    </AndroidThemeProvider>
  </ThemeProvider>
);

export default App;
