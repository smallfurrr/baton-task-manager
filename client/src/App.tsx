import { NavLink, Route, Routes } from "react-router-dom";
import styles from "./App.module.css";
import { TaskCreatePage } from "./pages/TaskCreatePage";
import { TaskListPage } from "./pages/TaskListPage";

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return [styles.navLink, isActive && styles.navLinkActive].filter(Boolean).join(" ");
}

export function App() {
  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.title}>Baton</h1>
        <nav className={styles.nav} aria-label="Main">
          <NavLink to="/" end className={navLinkClass}>
            Tasks
          </NavLink>
          <NavLink to="/tasks/new" className={navLinkClass}>
            Create task
          </NavLink>
        </nav>
      </header>
      <main className={styles.main}>
        <Routes>
          <Route path="/" element={<TaskListPage />} />
          <Route path="/tasks/new" element={<TaskCreatePage />} />
          <Route path="*" element={<h2>Page not found</h2>} />
        </Routes>
      </main>
    </>
  );
}
