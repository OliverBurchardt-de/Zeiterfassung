import type { User, OrderView } from './types';

/**
 * „Ports" (Schnittstellen), die die Domain definiert und die Infrastruktur erfuellt (ADR-01/05).
 * So bleiben Fachlogik und Aussenwelt (DB/DATEV) getrennt und testbar.
 */

export interface UserRepository {
  findByUsername(username: string): Promise<User | undefined>;
  findById(id: string): Promise<User | undefined>;
  list(): Promise<User[]>;
}

/** Eine Aufwands-/Zeitbuchung, wie sie nach DATEV (expensepostings) geschrieben wird. */
export interface ExpensePosting {
  orderId: string;
  suborderId: string;
  employeeId: string;
  /** Arbeitsdatum im DATEV-Format "TT.MM.JJJJ 00:00:00". */
  workDate: string;
  costPosition: string;
  /** 1 Stunde = 1200 Einheiten (verifiziert). */
  timeUnits: number;
  comment?: string;
}

/** Die einzige Stelle, ueber die mit DATEV gesprochen wird — austauschbar (Mock/Live). */
export interface DatevPort {
  health(): Promise<boolean>;
  getOrders(): Promise<OrderView[]>;
  getOrder(id: string): Promise<OrderView | undefined>;
  postExpensePosting(p: ExpensePosting): Promise<{ id: string }>;
}
