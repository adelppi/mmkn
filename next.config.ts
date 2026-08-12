import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // `next dev` が CLAUDE.md / AGENTS.md に自分の説明文を書き足すのを止める。
  // このリポジトリの CLAUDE.md は開発の規約そのものであり、道具が自動で書き換える場所ではない。
  agentRules: false,
}

export default nextConfig
