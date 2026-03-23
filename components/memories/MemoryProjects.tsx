/**
 * ============================================
 * AeroNyx Privacy Network - Memory Projects
 * ============================================
 * File Path: components/memories/MemoryProjects.tsx
 *
 * Creation Reason: Phase 4 — v2.4.0 project and session timeline panel.
 *   Shows auto-detected projects and their session history.
 *   Clicking a project shows its timeline; clicking a session opens
 *   the session detail drawer with conversation replay option.
 *
 * Main Functionality:
 *   - Project list: name, status badge, session count, last active
 *   - Session timeline grouped by date (ProjectTimeline)
 *   - Session detail drawer: title, summary, turn count, artifacts count
 *   - "View Conversation" button in drawer loads full replay on demand
 *   - Empty state when no projects exist yet
 *   - Skeleton loaders
 *
 * Dependencies:
 *   - hooks/useMemories.ts
 *   - types/memory.ts (Project, MpiSession, ConversationTurn, etc.)
 *
 * ⚠️ Important Note for Next Developer:
 * - Conversation replay is lazy-loaded — only fetches when user clicks
 *   "View Conversation" inside the session drawer (not on drawer open)
 * - session.title may be null (SuperNode hasn't processed it yet) —
 *   fall back to session_id prefix
 * - ProjectTimeline groups sessions by date — the backend returns
 *   timeline entries already grouped, just render them
 * - selectedProjectId drives the timeline view (replaces project list)
 *
 * Last Modified: v1.0.0 - Initial creation (Phase 4)
 * ============================================
 */

'use client';

import React, { useState, useCallback, memo } from 'react';
import {
  useProjects,
  useProjectTimeline,
  useSessionDetail,
  useSessionArtifacts,
  useSessionConversation,
} from '@/hooks/useMemories';
import type { Project, ProjectTimelineEntry } from '@/types/memory';

// ============================================
// Props
// ============================================

interface MemoryProjectsProps {
  nodeId: string;
}

// ============================================
// Skeleton
// ============================================

function ProjectsSkeleton() {
  return (
    <div className="space-y-1.5 animate-pulse">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-14 bg-white/[0.03] rounded-lg" />
      ))}
    </div>
  );
}

// ============================================
// Project status badge
// ============================================

function StatusBadge({ status }: { status: Project['status'] }) {
  const config = {
    active:   { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/25', label: 'Active' },
    archived: { bg: 'bg-gray-500/15',    text: 'text-gray-400',    border: 'border-gray-500/25',    label: 'Archived' },
    paused:   { bg: 'bg-yellow-500/15',  text: 'text-yellow-400',  border: 'border-yellow-500/25',  label: 'Paused' },
  }[status];

  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${config.bg} ${config.text} ${config.border}`}>
      {config.label}
    </span>
  );
}

// ============================================
// Relative time helper
// ============================================

function relativeDate(isoOrNull: string | null): string {
  if (!isoOrNull) return 'No sessions yet';
  const diff = Math.floor((Date.now() - new Date(isoOrNull).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(isoOrNull).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ============================================
// Project Row
// ============================================

interface ProjectRowProps {
  project: Project;
  onClick: (project: Project) => void;
}

const ProjectRow = memo(function ProjectRow({ project, onClick }: ProjectRowProps) {
  return (
    <button
      onClick={() => onClick(project)}
      className="
        w-full px-3 py-3 rounded-lg text-left
        flex items-start gap-3
        hover:bg-white/[0.03] border border-transparent hover:border-white/[0.06]
        transition-colors duration-150
      "
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm text-gray-200 font-medium truncate">{project.name}</p>
          <StatusBadge status={project.status} />
        </div>
        <p className="text-[11px] text-gray-600">
          {project.session_count} sessions · {project.entity_count} entities · {relativeDate(project.last_active_at)}
        </p>
      </div>
      <svg className="flex-shrink-0 w-3.5 h-3.5 text-gray-700 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
});

// ============================================
// Session Row (inside timeline)
// ============================================

interface SessionRowProps {
  session: ProjectTimelineEntry['sessions'][number];
  onClick: (sessionId: string) => void;
}

const SessionRow = memo(function SessionRow({ session, onClick }: SessionRowProps) {
  return (
    <button
      onClick={() => onClick(session.session_id)}
      className="
        w-full px-3 py-2.5 rounded-lg text-left
        flex items-start gap-3
        hover:bg-white/[0.03] border border-transparent hover:border-white/[0.06]
        transition-colors duration-150
      "
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-200 truncate">
          {session.title ?? `Session ${session.session_id.slice(0, 8)}...`}
        </p>
        {session.summary && (
          <p className="text-[11px] text-gray-500 truncate mt-0.5">{session.summary}</p>
        )}
      </div>
      <span className="flex-shrink-0 text-[11px] text-gray-600 mt-0.5">
        {session.turn_count} turns
      </span>
      <svg className="flex-shrink-0 w-3.5 h-3.5 text-gray-700 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
});

// ============================================
// Project Timeline View
// ============================================

interface ProjectTimelineViewProps {
  nodeId: string;
  project: Project;
  onBack: () => void;
  onSessionClick: (sessionId: string) => void;
}

function ProjectTimelineView({ nodeId, project, onBack, onSessionClick }: ProjectTimelineViewProps) {
  const { timeline, isLoading } = useProjectTimeline(nodeId, project.project_id);

  return (
    <div>
      {/* Back header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Projects
        </button>
        <span className="text-gray-700">/</span>
        <span className="text-sm text-white font-medium truncate">{project.name}</span>
        <StatusBadge status={project.status} />
      </div>

      {isLoading ? (
        <ProjectsSkeleton />
      ) : timeline.length === 0 ? (
        <p className="text-xs text-gray-600 py-6 text-center">No sessions in this project yet.</p>
      ) : (
        <div className="space-y-4">
          {timeline.map((entry) => (
            <div key={entry.date}>
              {/* Date separator — same style as MemoryList layer header */}
              <div className="flex items-center gap-3 py-2">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {new Date(entry.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
                <div className="flex-1 h-px bg-white/[0.04]" />
              </div>

              <div className="space-y-0">
                {entry.sessions.map((session) => (
                  <SessionRow
                    key={session.session_id}
                    session={session}
                    onClick={onSessionClick}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// Session Detail Drawer
// ============================================

interface SessionDrawerProps {
  nodeId: string;
  sessionId: string;
  onClose: () => void;
}

function SessionDrawer({ nodeId, sessionId, onClose }: SessionDrawerProps) {
  const { session, isLoading: sessionLoading } = useSessionDetail(nodeId, sessionId);
  const { artifacts } = useSessionArtifacts(nodeId, sessionId);
  const [showConversation, setShowConversation] = useState(false);

  // Only fetch conversation when user explicitly requests it
  const { conversation, isLoading: convLoading } = useSessionConversation(
    nodeId,
    showConversation ? sessionId : ''
  );

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="
        fixed z-50
        inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2
        sm:-translate-x-1/2 sm:-translate-y-1/2
        w-full sm:max-w-lg
        bg-[#12121A] border-t sm:border border-white/[0.08]
        rounded-t-2xl sm:rounded-2xl
        shadow-2xl max-h-[85vh] overflow-y-auto
      ">
        {/* Handle (mobile) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/10" />
        </div>

        <div className="px-5 py-4 sm:p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-5 gap-3">
            <h2 className="text-lg font-semibold text-white leading-snug">
              {sessionLoading
                ? <span className="animate-pulse block h-6 w-48 bg-white/5 rounded" />
                : (session?.title ?? `Session ${sessionId.slice(0, 8)}...`)
              }
            </h2>
            <button
              onClick={onClose}
              className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-gray-300 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {sessionLoading ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-4 bg-white/[0.04] rounded w-full" />
              <div className="h-4 bg-white/[0.04] rounded w-4/5" />
            </div>
          ) : session ? (
            <>
              {/* Summary */}
              {session.summary && !session.summary.startsWith('Topics:') && (
                <p className="text-sm text-gray-400 mb-4 leading-relaxed">{session.summary}</p>
              )}

              {/* Meta */}
              <div className="flex items-center gap-4 text-xs text-gray-500 mb-5">
                <span>{session.turn_count} turns</span>
                {artifacts.length > 0 && (
                  <span>{artifacts.length} artifact{artifacts.length !== 1 ? 's' : ''}</span>
                )}
                <span>
                  {new Date(session.started_at * 1000).toLocaleDateString(undefined, {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </span>
              </div>

              {/* Artifacts preview */}
              {artifacts.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Code Artifacts</p>
                  <div className="space-y-1">
                    {artifacts.slice(0, 4).map((a) => (
                      <div key={a.artifact_id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/[0.02] text-xs">
                        <span className="text-gray-600 font-mono">{a.language ?? 'code'}</span>
                        <span className="text-gray-400 truncate">{a.title ?? a.artifact_id.slice(0, 16)}</span>
                        {a.line_count && <span className="text-gray-600 flex-shrink-0">{a.line_count}L</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Conversation replay */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Conversation</p>
                {!showConversation ? (
                  <button
                    onClick={() => setShowConversation(true)}
                    className="
                      w-full px-4 py-2.5 rounded-xl
                      bg-white/[0.04] border border-white/[0.08]
                      text-sm text-gray-400 hover:text-white hover:bg-white/[0.07]
                      transition-colors
                    "
                  >
                    Load conversation replay
                  </button>
                ) : convLoading ? (
                  <div className="space-y-2 animate-pulse">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="h-8 bg-white/[0.03] rounded" />
                    ))}
                  </div>
                ) : conversation?.turns && conversation.turns.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {conversation.turns.map((turn) => (
                      <div
                        key={turn.turn_index}
                        className={`px-3 py-2 rounded-lg text-xs leading-relaxed ${
                          turn.role === 'user'
                            ? 'bg-purple-500/10 border border-purple-500/15 text-gray-300 ml-6'
                            : 'bg-white/[0.03] border border-white/[0.06] text-gray-400 mr-6'
                        }`}
                      >
                        <span className="text-[10px] uppercase tracking-wide text-gray-600 block mb-1">{turn.role}</span>
                        {turn.content}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-600">No conversation data available.</p>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}

// ============================================
// Main Component
// ============================================

export default function MemoryProjects({ nodeId }: MemoryProjectsProps) {
  const { projects, isLoading } = useProjects(nodeId);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const handleProjectClick = useCallback((project: Project) => {
    setSelectedProject(project);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedProject(null);
  }, []);

  const handleSessionClick = useCallback((sessionId: string) => {
    setSelectedSessionId(sessionId);
  }, []);

  const handleSessionClose = useCallback(() => {
    setSelectedSessionId(null);
  }, []);

  if (isLoading) return <ProjectsSkeleton />;

  if (projects.length === 0) {
    return (
      <div className="py-12 text-center">
        <svg className="w-10 h-10 mx-auto text-gray-700 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        <p className="text-sm text-gray-500">No projects detected yet.</p>
        <p className="text-xs text-gray-600 mt-1">
          Projects are auto-detected from your conversations. Keep chatting!
        </p>
      </div>
    );
  }

  return (
    <div>
      {selectedProject ? (
        <ProjectTimelineView
          nodeId={nodeId}
          project={selectedProject}
          onBack={handleBack}
          onSessionClick={handleSessionClick}
        />
      ) : (
        <div className="space-y-0">
          {projects.map((project) => (
            <ProjectRow
              key={project.project_id}
              project={project}
              onClick={handleProjectClick}
            />
          ))}
        </div>
      )}

      {selectedSessionId && (
        <SessionDrawer
          nodeId={nodeId}
          sessionId={selectedSessionId}
          onClose={handleSessionClose}
        />
      )}
    </div>
  );
}
