import Board from './board';
import styles from './page.module.css';

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main} style={{ width: '100%', maxWidth: 960 }}>
        <h1>Taskboard0</h1>
        <p style={{ marginBottom: 24, opacity: 0.7 }}>
          Demo XAA resource app — a tiny Linear-style issue tracker. This board updates live as the
          agent calls the protected API in <code className={styles.code}>src/app/api/v1</code>.
        </p>
        <Board />
      </main>
    </div>
  );
}
