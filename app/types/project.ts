export type ProjectStage = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type DocumentStatus = 'pending' | 'uploaded' | 'approved'

export interface ChecklistItem {
  id: string
  label: string
  done: boolean
}

export interface StageDocument {
  id: string
  name: string
  status: DocumentStatus
  uploadedAt?: string
}

export interface StageData {
  stage: ProjectStage
  checklist: ChecklistItem[]
  documents: StageDocument[]
  notes?: string
}

export interface Project {
  id: string
  name: string
  client: string
  location: string
  description?: string
  currentStage: ProjectStage
  createdAt: string
  stages: StageData[]
}
