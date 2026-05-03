# Lumina Flow | Data Intelligence Workbench

Lumina Flow is a premium, industrial-grade data intelligence platform designed for high-fidelity agentic decision-making. It transforms raw database interactions into a "Deep Space Surgical" cockpit experience, providing transparent, evidence-grounded insights.

## ✨ Features

- **Agentic Reasoning Pipeline**: Real-time visualization of the AI agent's decision-making process, from thought to action.
- **Insight Canvas**: A dynamic, ambient workspace for visualizing data anomalies, trends, and complex analytics.
- **Ask Flow (Clarification System)**: Interactive clarification loops that resolve business logic ambiguities before execution, ensuring 100% accuracy.
- **SQL Audit & Protocol**: Strict server-side schema validation and transparent SQL execution logs for enterprise-grade auditability.
- **Semantic Layer**: Automated semantic bootstrapping that bridges the gap between raw data schemas and natural language intent.
- **Surgical Aesthetics**: An ultra-minimalist UI featuring NovaPulse lighting, constellation grid patterns, and premium glassmorphism.

## 🚀 Tech Stack

- **Core**: [Next.js](https://nextjs.org/) (App Router)
- **AI Orchestration**: [Vercel AI SDK](https://sdk.vercel.ai/)
- **Database**: PostgreSQL / MySQL (with scalable driver architecture)
- **Styling**: Vanilla CSS with high-fidelity design tokens
- **Visualization**: Recharts & Custom SVG Components

## 🛠️ Getting Started

### Prerequisites

- Node.js (v20+)
- pnpm (recommended)
- Docker (for database environment)

### Setup

1. **Clone the repository**:
   ```bash
   git clone git@github.com:Hello-Nemo/data-agent.git
   cd data-agent
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Configure environment**:
   Copy `.env.example` to `.env` and fill in your AI provider keys and database credentials.

4. **Launch database**:
   ```bash
   docker-compose up -d
   ```

5. **Start development server**:
   ```bash
   pnpm run dev
   ```

## 📐 Architecture

- `/src/lib/agent.ts`: The core multi-agent orchestration logic.
- `/src/lib/tools/`: Domain-specific tools for database interaction and visualization.
- `/src/components/`: Premium UI components following the "Lumina Flow" design system.
- `/scripts/`: Automated onboarding and evaluation utilities.

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
