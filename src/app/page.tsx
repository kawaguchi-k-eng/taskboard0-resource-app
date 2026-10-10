import Board from './board';
import styles from './page.module.css';

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main} style={{ width: '100%', maxWidth: 960 }}>
        <h1>Taskboard0</h1>
        <p style={{ marginBottom: 24, opacity: 0.7 }}>
          XAA デモ用リソースアプリ — Linear 風の小さな課題管理ツールです。エージェントが
          保護された API（<code className={styles.code}>src/app/api/v1</code>）を呼び出すと、このボードがリアルタイムに更新されます。
        </p>
        <Board />
      </main>
    </div>
  );
}
