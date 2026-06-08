# Kiln Controller — React Frontend

## Structure

```
src/
├── lib/
│   └── api.js          ← All API calls to FastAPI backend
├── hooks/
│   └── useToast.js     ← Toast notification hook
├── components/
│   ├── Sidebar.jsx     ← Left navigation sidebar
│   ├── Modal.jsx       ← Reusable modal wrapper
│   ├── Badge.jsx       ← Status badge (pending/running/completed/aborted)
│   ├── EmptyState.jsx  ← Empty list placeholder
│   └── BurnChart.jsx   ← Canvas chart for burn detail
├── pages/
│   ├── KilnsPage.jsx        ← List & manage kilns
│   ├── KilnModal.jsx        ← Create/edit kiln form
│   ├── TemplatesPage.jsx    ← List & manage templates
│   ├── TemplateModal.jsx    ← Create/edit template + curve segments
│   ├── BurnsPage.jsx        ← List burns
│   ├── BurnModal.jsx        ← Create burn form
│   └── BurnDetailPage.jsx   ← Live burn view (chart + logs + PID)
└── App.jsx             ← Root, router, layout
```

## Setup

```bash
npm install
npm run dev       # dev server on :5173
npm run build     # production build → dist/
```

Copy `dist/` contents to FastAPI's `static/` folder for deployment.

## Backend
FastAPI runs on port 8000. In dev, Vite proxies `/api` → `http://localhost:8000`.
In production (same origin), no proxy needed.
