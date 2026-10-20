import site from "../data/site.json";

export type ProjectImage = { src: string; alt: string };

export type Project = {
  slug: string;
  title: string;
  year: string;
  medium: string;
  size: string;
  category: "Graphic Design" | "2D" | "3D" | string;
  cover: string;
  images: ProjectImage[];
  paragraphs: string[];
  related: string[];
  order: number;
};

export const base = import.meta.env.BASE_URL;

export function href(path = ""): string {
  if (!path) return base;
  if (/^(https?:|mailto:|tel:)/.test(path)) return path;
  return `${base}${path.replace(/^\//, "")}`;
}

export function asset(path: string): string {
  return href(path);
}

const modules = import.meta.glob("../data/projects/*.json", {
  eager: true,
}) as Record<string, { default: Project }>;

export function getProjects(): Project[] {
  return Object.values(modules)
    .map((mod) => mod.default)
    .sort((a, b) => a.order - b.order);
}

export function getProject(slug: string): Project | undefined {
  return getProjects().find((project) => project.slug === slug);
}

export function projectHeading(project: Project): string {
  const title = project.title.toLowerCase();
  return title.endsWith(".") ? title : `${title}.`;
}

export { site };
