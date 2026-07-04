import { BASE_URL } from "./constants";

export const api = {
  // ─── 1. SALES ROUTER ───────────────────────────────────────
  sales: {
    getAll: () => {
      return fetch(`${BASE_URL}/sales`).then(res => res.json());
    },
    create: (data: any) => {
      return fetch(`${BASE_URL}/sales`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      }).then(res => res.json());
    }
  },

  // ─── 2. CLIENT ROUTER ──────────────────────────────────────
  client: {
    getAll: () => {
      return fetch(`${BASE_URL}/client`).then(res => res.json());
    },
    create: (data: any) => {
      return fetch(`${BASE_URL}/client`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      }).then(res => res.json());
    }
  },

  // ─── 3. INVENTORY ROUTER ───────────────────────────────────
  inventory: {
    getAll: () => {
      return fetch(`${BASE_URL}/inventory`).then(res => res.json());
    },
    create: (data: any) => {
      return fetch(`${BASE_URL}/inventory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      }).then(res => res.json());
    }
  },

  // ─── 4. JOB COSTING ROUTER ─────────────────────────────────
  jobCosting: {
    getAll: () => {
      return fetch(`${BASE_URL}/job_costing`).then(res => res.json());
    },
    create: (data: any) => {
      return fetch(`${BASE_URL}/job_costing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      }).then(res => res.json());
    }
  },

  // ─── 5. EMPLOYEE ROUTER ────────────────────────────────────
  employee: {
    getAll: () => {
      return fetch(`${BASE_URL}/employee`).then(res => res.json());
    },
    create: (data: any) => {
      return fetch(`${BASE_URL}/employee`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      }).then(res => res.json());
    }
  },

  // ─── 6. EXPENSES ROUTER ────────────────────────────────────
  expenses: {
    getAll: () => {
      return fetch(`${BASE_URL}/expenses`).then(res => res.json());
    },
    create: (data: any) => {
      return fetch(`${BASE_URL}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      }).then(res => res.json());
    }
  },

  // ─── 7. INQUIRIES ROUTER ───────────────────────────────────
  inquiries: {
    getAll: () => {
      return fetch(`${BASE_URL}/inquiries`).then(res => res.json());
    },
    create: (data: any) => {
      return fetch(`${BASE_URL}/inquiries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      }).then(res => res.json());
    }
  }
};