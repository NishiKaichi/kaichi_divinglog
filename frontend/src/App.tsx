import { Link, Navigate, Route, Routes, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { client, githubLoginUrl } from "./api";
import type { Creature, Post, SearchResult } from "./types";

function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <header>
        <h1>Kaichi divinglog</h1>
        <nav>
          <Link to="/">Home</Link>
          <Link to="/creatures">Creatures</Link>
          <Link to="/blog">Blog</Link>
          <Link to="/search">Search</Link>
          <Link to="/admin">Admin</Link>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}

function HomePage() {
  return (
    <Layout>
      <section>
        <h2>生き物図鑑とダイビングログ</h2>
        <p>図鑑、ブログ、AI検索をまとめた個人サイトです。</p>
        <Link to="/search">AI検索を使う</Link>
      </section>
    </Layout>
  );
}

function CreatureListPage() {
  const [items, setItems] = useState<Creature[]>([]);
  useEffect(() => {
    client.getCreatures().then(setItems).catch(console.error);
  }, []);
  return (
    <Layout>
      <h2>図鑑一覧</h2>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <Link to={`/creatures/${item.slug}`}>{item.nameJa}</Link>
          </li>
        ))}
      </ul>
    </Layout>
  );
}

function CreatureDetailPage() {
  const { slug = "" } = useParams();
  const [item, setItem] = useState<Creature | null>(null);
  useEffect(() => {
    client.getCreature(slug).then(setItem).catch(console.error);
  }, [slug]);
  if (!item) return <Layout>Loading...</Layout>;
  return (
    <Layout>
      <h2>{item.nameJa}</h2>
      <p>{item.description}</p>
      <p>{item.locationText}</p>
    </Layout>
  );
}

function BlogListPage() {
  const [items, setItems] = useState<Post[]>([]);
  useEffect(() => {
    client.getPosts().then(setItems).catch(console.error);
  }, []);
  return (
    <Layout>
      <h2>ブログ一覧</h2>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <Link to={`/blog/${item.slug}`}>{item.title}</Link>
          </li>
        ))}
      </ul>
    </Layout>
  );
}

function BlogDetailPage() {
  const { slug = "" } = useParams();
  const [item, setItem] = useState<Post | null>(null);
  useEffect(() => {
    client.getPost(slug).then(setItem).catch(console.error);
  }, [slug]);
  if (!item) return <Layout>Loading...</Layout>;
  return (
    <Layout>
      <h2>{item.title}</h2>
      <ReactMarkdown>{item.body}</ReactMarkdown>
    </Layout>
  );
}

function SearchPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    const data = await client.search(q);
    setResults(data.results);
  };
  return (
    <Layout>
      <h2>AI検索</h2>
      <form onSubmit={submit}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="例: サンゴの近くの魚" />
        <button type="submit">検索</button>
      </form>
      <ul>
        {results.map((r, idx) => (
          <li key={`${r.url}-${idx}`}>
            <Link to={r.url}>{r.title}</Link>
            <p>{r.snippet}</p>
          </li>
        ))}
      </ul>
    </Layout>
  );
}

function AdminLoginPage() {
  return (
    <Layout>
      <h2>Admin Login</h2>
      <a className="button" href={githubLoginUrl()}>
        GitHubでログイン
      </a>
    </Layout>
  );
}

function useAdminAuth() {
  const [loading, setLoading] = useState(true);
  const [ok, setOk] = useState(false);
  useEffect(() => {
    client
      .me()
      .then((v) => setOk(Boolean(v.authenticated && v.isAdmin)))
      .catch(() => setOk(false))
      .finally(() => setLoading(false));
  }, []);
  return { loading, ok };
}

function AdminGuard({ children }: { children: ReactNode }) {
  const { loading, ok } = useAdminAuth();
  if (loading) return <Layout>Loading...</Layout>;
  if (!ok) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

function AdminDashboard() {
  return (
    <Layout>
      <h2>Admin</h2>
      <ul>
        <li>
          <Link to="/admin/creatures">図鑑管理</Link>
        </li>
        <li>
          <Link to="/admin/posts">ブログ管理</Link>
        </li>
        <li>
          <Link to="/admin/search">検索インデックス</Link>
        </li>
      </ul>
    </Layout>
  );
}

function CreatureEditor({ mode }: { mode: "new" | "edit" }) {
  const { id = "" } = useParams();
  const [nameJa, setNameJa] = useState("");
  const [description, setDescription] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "new") {
      await client.createCreature({ nameJa, description });
    } else {
      await client.updateCreature(id, { nameJa, description });
    }
    window.location.hash = "#/admin/creatures";
  };
  return (
    <Layout>
      <h2>{mode === "new" ? "図鑑新規作成" : "図鑑編集"}</h2>
      <form onSubmit={submit}>
        <label>和名</label>
        <input value={nameJa} onChange={(e) => setNameJa(e.target.value)} required />
        <label>説明</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} required />
        <button type="submit">保存</button>
      </form>
    </Layout>
  );
}

function PostEditor({ mode }: { mode: "new" | "edit" }) {
  const { id = "" } = useParams();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "new") {
      await client.createPost({ title, body, publishedAt: new Date().toISOString() });
    } else {
      await client.updatePost(id, { title, body });
    }
    window.location.hash = "#/admin/posts";
  };
  return (
    <Layout>
      <h2>{mode === "new" ? "ブログ新規作成" : "ブログ編集"}</h2>
      <form onSubmit={submit}>
        <label>タイトル</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        <label>本文（Markdown）</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={12} />
        <button type="submit">保存</button>
      </form>
    </Layout>
  );
}

function AdminCreatureList() {
  const [items, setItems] = useState<Creature[]>([]);
  useEffect(() => {
    client.getCreatures().then(setItems).catch(console.error);
  }, []);
  return (
    <Layout>
      <h2>図鑑管理</h2>
      <Link to="/admin/creatures/new">新規作成</Link>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            {item.nameJa} <Link to={`/admin/creatures/${item.id}/edit`}>編集</Link>
          </li>
        ))}
      </ul>
    </Layout>
  );
}

function AdminPostList() {
  const [items, setItems] = useState<Post[]>([]);
  useEffect(() => {
    client.getPosts().then(setItems).catch(console.error);
  }, []);
  return (
    <Layout>
      <h2>ブログ管理</h2>
      <Link to="/admin/posts/new">新規作成</Link>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            {item.title} <Link to={`/admin/posts/${item.id}/edit`}>編集</Link>
          </li>
        ))}
      </ul>
    </Layout>
  );
}

function AdminSearchPage() {
  const [message, setMessage] = useState("");
  const run = async () => {
    const v = await client.reindexAll();
    setMessage(`reindexed: ${v.count}`);
  };
  return (
    <Layout>
      <h2>検索インデックス管理</h2>
      <button onClick={run}>全再生成</button>
      {message && <p>{message}</p>}
    </Layout>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/creatures" element={<CreatureListPage />} />
      <Route path="/creatures/:slug" element={<CreatureDetailPage />} />
      <Route path="/blog" element={<BlogListPage />} />
      <Route path="/blog/:slug" element={<BlogDetailPage />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route
        path="/admin"
        element={
          <AdminGuard>
            <AdminDashboard />
          </AdminGuard>
        }
      />
      <Route
        path="/admin/creatures"
        element={
          <AdminGuard>
            <AdminCreatureList />
          </AdminGuard>
        }
      />
      <Route
        path="/admin/creatures/new"
        element={
          <AdminGuard>
            <CreatureEditor mode="new" />
          </AdminGuard>
        }
      />
      <Route
        path="/admin/creatures/:id/edit"
        element={
          <AdminGuard>
            <CreatureEditor mode="edit" />
          </AdminGuard>
        }
      />
      <Route
        path="/admin/posts"
        element={
          <AdminGuard>
            <AdminPostList />
          </AdminGuard>
        }
      />
      <Route
        path="/admin/posts/new"
        element={
          <AdminGuard>
            <PostEditor mode="new" />
          </AdminGuard>
        }
      />
      <Route
        path="/admin/posts/:id/edit"
        element={
          <AdminGuard>
            <PostEditor mode="edit" />
          </AdminGuard>
        }
      />
      <Route
        path="/admin/search"
        element={
          <AdminGuard>
            <AdminSearchPage />
          </AdminGuard>
        }
      />
    </Routes>
  );
}
