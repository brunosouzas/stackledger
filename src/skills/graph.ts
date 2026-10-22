/** The declared relations of a skill set as a graph (skills-map-command spec: Declared relations only,
 * Order of relations, Item page's "Reached through"). Used by src/skills/mermaid.ts; `skills-site` is
 * meant to draw the same graph, so the Markdown map and the site cannot disagree. Pure: no I/O.
 *
 * Nodes are keyed by kind and name: skills and playbooks share one namespace (a skill set's skill
 * names are unique across both), agents have their own, so a skill and an agent may share a name.
 * Edges, each drawn once:
 * - `loads`: a skill or playbook to each skill or playbook in its `stackledger-skills`;
 * - `uses`: a skill or playbook to each agent in its `stackledger-agents`;
 * - `preloads`: an agent to each skill or playbook in its `skills`.
 * An edge to a name not in the set is dropped (`skills validate` reports it); a self-relation and
 * cycles are kept. Nothing is ever guessed from the text of a file (ADR 10).
 */
import { compareText } from '../identity.js';
import type { SkillSet, SourceFile } from './source.js';

export type NodeKind = 'skill' | 'playbook' | 'agent';
export type RelationKind = 'loads' | 'uses' | 'preloads';
/** The fixed order of kinds (lists, tables and diagram nodes) and of relation kinds (diagram edges). */
const KIND_ORDER: Record<NodeKind, number> = { skill: 0, playbook: 1, agent: 2 };
const RELATION_ORDER: Record<RelationKind, number> = { loads: 0, uses: 1, preloads: 2 };

export interface MapNode {
  /** Unique within the graph: kind and name. */
  key: string;
  kind: NodeKind;
  name: string;
  description: string;
  /** Rule IDs in file order (skills and playbooks; none for agents). */
  rules: string[];
  files: SourceFile[];
}
export interface MapEdge { from: MapNode; kind: RelationKind; to: MapNode }
export interface SkillGraph {
  /** By kind, then name. */
  nodes: MapNode[];
  /** By source node, relation kind, then target node. */
  edges: MapEdge[];
}

/** Diagram order: kind (skill, playbook, agent), then name by code point. */
export function compareNodes(left: MapNode, right: MapNode): number {
  return KIND_ORDER[left.kind] - KIND_ORDER[right.kind] || compareText(left.name, right.name);
}
/** List and table order: name by code point, then kind. */
export function compareListed(left: MapNode, right: MapNode): number {
  return compareText(left.name, right.name) || KIND_ORDER[left.kind] - KIND_ORDER[right.kind];
}
export function compareEdges(left: MapEdge, right: MapEdge): number {
  return compareNodes(left.from, right.from) || RELATION_ORDER[left.kind] - RELATION_ORDER[right.kind] || compareNodes(left.to, right.to);
}

// Keys are JSON arrays, never joined text: a YAML name can hold any character, a NUL or a quote
// included, and JSON escapes them, so two different tuples never give one key.
const keyOf = (kind: NodeKind, name: string) => JSON.stringify([kind, name]);

/** The graph of a skill set's declared relations. */
export function buildGraph(set: Pick<SkillSet, 'skills' | 'agents'>): SkillGraph {
  const nodes: MapNode[] = [];
  const skillsByName = new Map<string, MapNode>(), agentsByName = new Map<string, MapNode>();
  for (const skill of set.skills) {
    const node: MapNode = { key: keyOf(skill.kind, skill.name), kind: skill.kind, name: skill.name, description: skill.description,
      rules: skill.rules.map(rule => rule.id), files: skill.files };
    nodes.push(node); skillsByName.set(skill.name, node);
  }
  for (const agent of set.agents) {
    const node: MapNode = { key: keyOf('agent', agent.name), kind: 'agent', name: agent.name, description: agent.description, rules: [], files: agent.files };
    nodes.push(node); agentsByName.set(agent.name, node);
  }
  const edges: MapEdge[] = [];
  const seen = new Set<string>();
  const add = (from: MapNode, kind: RelationKind, to: MapNode | undefined) => {
    if (!to) return;
    const key = JSON.stringify([from.key, kind, to.key]);
    if (seen.has(key)) return;
    seen.add(key); edges.push({ from, kind, to });
  };
  for (const skill of set.skills) {
    const from = skillsByName.get(skill.name)!;
    for (const name of skill.skills) add(from, 'loads', skillsByName.get(name));
    for (const name of skill.agents) add(from, 'uses', agentsByName.get(name));
  }
  for (const agent of set.agents) {
    const from = agentsByName.get(agent.name)!;
    for (const name of agent.preloads) add(from, 'preloads', skillsByName.get(name));
  }
  return { nodes: nodes.sort(compareNodes), edges: edges.sort(compareEdges) };
}

/** The relations that bring `node` in, in list order (name of the other item, then kind). */
export function incoming(graph: SkillGraph, node: MapNode): MapEdge[] {
  return graph.edges.filter(edge => edge.to === node).sort((left, right) => compareListed(left.from, right.from));
}
/** The relations `node` brings in, in list order. */
export function outgoing(graph: SkillGraph, node: MapNode): MapEdge[] {
  return graph.edges.filter(edge => edge.from === node).sort((left, right) => compareListed(left.to, right.to));
}

/** "Reached through": the items that bring `node` in only through two or more relations, in list order.
 * A breadth-first walk over incoming edges visits each item once at its shortest distance, so cycles
 * end; the item itself and what brings it in directly are not listed. */
export function reachedThrough(graph: SkillGraph, node: MapNode): MapNode[] {
  const sources = new Map<MapNode, MapNode[]>();
  for (const edge of graph.edges) sources.set(edge.to, [...(sources.get(edge.to) ?? []), edge.from]);
  const distance = new Map<MapNode, number>([[node, 0]]);
  const queue = [node];
  while (queue.length) {
    const current = queue.shift()!;
    for (const source of sources.get(current) ?? []) {
      if (distance.has(source)) continue;
      distance.set(source, distance.get(current)! + 1);
      queue.push(source);
    }
  }
  return [...distance].filter(([, steps]) => steps >= 2).map(([found]) => found).sort(compareListed);
}
