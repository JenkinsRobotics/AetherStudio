/** Window-local grouping for the review mockup. Task content remains in
 * DocumentCollaboration; cards only reference those canonical item IDs. */
export interface ModelTaskCard { id: string; name: string; taskIds: string[] }
export const modelTaskCards = (): ModelTaskCard[] => [
  { id: 'body', name: 'Main body', taskIds: ['wall-task', 'bracket-task'] },
  { id: 'analysis', name: 'Analysis', taskIds: ['fea-task', 'thermal-task'] },
  { id: 'drawings', name: 'Drawings', taskIds: ['drawing-task'] },
  { id: 'release', name: 'Release checks', taskIds: ['fastener-task'] },
];
