import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../app/AuthContext';
import type { Project } from '../../shared/types';
import { Button, EmptyState, ErrorState, Field, Status } from '../../shared/ui';

export function Dashboard() {
  const { auth } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [title, setTitle] = useState('Stage 1 launch review');
  const [description, setDescription] = useState('Assess product, security, legal and delivery risk.');
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!auth) return;
    setProjects(await api.listProjects(auth.workspaceId));
  };

  useEffect(() => {
    void load();
  }, [auth?.workspaceId]);

  const create = async () => {
    if (!auth) return;
    setError(null);
    try {
      const project = await api.createProject(auth.csrfToken, auth.workspaceId, title, description);
      setProjects((current) => [project, ...current]);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section className="screen">
      <div className="screen-header">
        <div>
          <h1>Projects</h1>
          <p className="muted">Create a review workspace and keep every run source-linked.</p>
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
          <ErrorState message={error} />
          <Button type="button" variant="primary" onClick={create}>
            <Plus size={16} /> Create project
          </Button>
        </form>
        <div className="panel stack">
          <h2>Active projects</h2>
          {projects.length === 0 ? (
            <EmptyState title="No projects yet" body="Create the first project to start a structured review." />
          ) : (
            <div className="list">
              {projects.map((project) => (
                <article className="list-item" key={project.id}>
                  <div>
                    <strong>{project.title}</strong>
                    <p className="muted">{project.description || 'No description provided.'}</p>
                  </div>
                  <Link className="button secondary" to={`/projects/${project.id}/reviews/new`}>
                    New review
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
