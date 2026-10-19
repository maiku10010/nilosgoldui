import { brand } from "./brand";

  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  document.title = brand.name;
  document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.setAttribute('href', brand.logo);
  createRoot(document.getElementById("root")!).render(<App />);
  