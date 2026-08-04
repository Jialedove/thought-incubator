import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "思想孵化器",
  description: "一个把话语权还给用户的本地优先思想工作台。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: "try { const t = localStorage.getItem('thought-incubator-theme') || 'system'; document.documentElement.dataset.theme = t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : t === 'system' ? 'light' : t; } catch {}" }} /></head><body>{children}</body></html>;
}
