import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../app/AuthContext';
import type { Project } from '../../shared/types';
import { Button, EmptyState, ErrorState, Field, Status } from '../../shared/ui';

export function Dashboard() {
  const { auth } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [title, setTitle] = useState('Decision review workspace');
  const [description, setDescription] = useState('Red-team a project, proposal, essay, policy or code change.');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);

  const load = async () => {
    if (!auth) return;
    setProjects(await api.listProjects(auth.workspaceId));
  };

  useEffect(() => {
    void load();
  }, [auth?.workspaceId]);

  const create = async () => {
    if (!auth) return;
    setCreateError(null);
    try {
      const project = await api.createProject(auth.csrfToken, auth.workspaceId, title, description);
      setProjects((current) => [project, ...current]);
    } catch (err) {
      setCreateError((err as Error).message);
    }
  };

  const beginEdit = (project: Project) => {
    setProjectError(null);
    setConfirmDeleteId(null);
    setEditingId(project.id);
    setEditTitle(project.title);
    setEditDescription(project.description);
  };

  const saveEdit = async (projectId: string) => {
    if (!auth) return;
    setProjectError(null);
    setPendingProjectId(projectId);
    try {
      const project = await api.updateProject(auth.csrfToken, projectId, editTitle, editDescription);
      setProjects((current) => current.map((item) => (item.id === project.id ? project : item)));
      setEditingId(null);
    } catch (err) {
      setProjectError((err as Error).message);
    } finally {
      setPendingProjectId(null);
    }
  };

  const deleteProject = async (projectId: string) => {
    if (!auth) return;
    setProjectError(null);
    setPendingProjectId(projectId);
    try {
      await api.deleteProject(auth.csrfToken, projectId);
      setProjects((current) => current.filter((item) => item.id !== projectId));
      setConfirmDeleteId(null);
    } catch (err) {
      setProjectError((err as Error).message);
    } finally {
      setPendingProjectId(null);
    }
  };

  return (
    <section className="screen">
      <div className="screen-header">
        <div>
          <h1>Projects</h1>
          <p className="muted">Create a workspace for any decision artefact and keep every workflow source-linked.</p>
        </div>
        <Status tone="ok">Tenant isolated</Status>
      </div>
      <div className="grid">
        <form className="panel stack" onSubmit={(event) => event.preventDefault()}>
          <h2>New project</h2>
          <Field label="Project title">
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </Field>
          <Field label="Description">
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} />
          </Field>
          <ErrorState message={createError} />
          <Button type="button" variant="primary" onClick={create}>
            <Plus size={16} /> Create project
          </Button>
        </form>
        <div className="panel stack">
          <h2>Active projects</h2>
          <ErrorState message={projectError} />
          {projects.length === 0 ? (
            <EmptyState title="No projects yet" body="Create the first decision space to start a structured review." />
          ) : (
            <div className="list">
              {projects.map((project) => (
                <article className="list-item project-item" key={project.id}>
                  {editingId === project.id ? (
                    <div className="project-edit stack">
                      <Field label="Edit project title">
                        <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} />
                      </Field>
                      <Field label="Edit description">
                        <textarea
                          value={editDescription}
                          onChange={(event) => setEditDescription(event.target.value)}
                          rows={3}
                        />
                      </Field>
                      <div className="row">
                        <Button
                          type="button"
                          variant="primary"
                          onClick={() => void saveEdit(project.id)}
                          disabled={pendingProjectId === project.id}
                        >
                          Save changes
                        </Button>
                        <Button type="button" onClick={() => setEditingId(null)}>
                          <X size={16} /> Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <strong>{project.title}</strong>
                        <p className="muted">{project.description || 'No description provided.'}</p>
                      </div>
                      <div className="project-actions row">
                        <Link className="button secondary" to={`/projects/${project.id}/reviews/new`}>
                          New review
                        </Link>
                        <Button type="button" onClick={() => beginEdit(project)}>
                          <Pencil size={16} /> Edit
                        </Button>
                        {confirmDeleteId === project.id ? (
                          <>
                            <Button
                              type="button"
                              variant="danger"
                              onClick={() => void deleteProject(project.id)}
                              disabled={pendingProjectId === project.id}
                            >
                              Confirm delete
                            </Button>
                            <Button type="button" onClick={() => setConfirmDeleteId(null)}>
                              <X size={16} /> Cancel
                            </Button>
                          </>
                        ) : (
                          <Button type="button" variant="danger" onClick={() => setConfirmDeleteId(project.id)}>
                            <Trash2 size={16} /> Delete
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
