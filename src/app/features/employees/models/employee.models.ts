// Maya (the marketing employee) still writes progress/blocker notes onto the
// Moves she syncs to via todd-backend's task_sync duty (see
// shared/data/interfaces/task.model.ts `notesLog` and
// services/task.service.ts `addTaskNote`). This type is the only piece of
// what used to be a broader Employee* data-model abstraction that the Task
// feature still depends on now that the internal marketing-director /
// marketing-employee Angular feature has been extracted into its own app.
export interface EmployeeActionNoteEntry {
  at: string;
  author: 'maya' | 'user';
  authorLabel?: string;
  text: string;
}
