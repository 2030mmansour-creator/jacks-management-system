export interface Project {
  id: number;
  name: string;
  location: string;
}

export interface JackType {
  id: number;
  name: string;
  daily_rate: number;
}

export interface Transaction {
  id: number;
  project_id: number;
  jack_type_id: number;
  quantity: number;
  date: string;
  type: 'IN' | 'OUT';
  project_name?: string;
  jack_name?: string;
  daily_rate?: number;
}

export interface User {
  username: string;
  role: 'admin' | 'supervisor';
}

export interface CalculationResult {
  jack_name: string;
  project_name: string;
  quantity: number;
  entry_date: string;
  exit_date: string;
  days: number;
  daily_rate: number;
  total_cost: number;
}
