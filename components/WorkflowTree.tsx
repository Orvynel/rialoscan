import { Hash } from "./Hash";
import { formatUtc, groupDigits, plural } from "@/lib/format";
import type { WorkflowNode } from "@/lib/chain";
import type { ProgramInfo } from "@/lib/programs";

/**
 * The causal tree of a reactive transaction.
 *
 * This is the part of Rialo that has no Solana equivalent. A transaction can
 * register an on-chain predicate; when validators evaluate it at the end of a
 * block they enqueue a follow-up transaction automatically. `getWorkflowLineage`
 * exposes that as a parent/child graph, so "who caused this transaction to
 * exist" is answerable — which on any other chain it is not.
 *
 * Rendered as an actual nested tree rather than a flat table, because the depth
 * relationship *is* the information.
 */
export function WorkflowTree({
  root,
  currentId,
  programs,
}: {
  root: WorkflowNode;
  currentId?: string;
  programs: Map<string, ProgramInfo>;
}) {
  return (
    <div className="tree">
      <ul className="tree-list">
        <TreeItem node={root} currentId={currentId} programs={programs} />
      </ul>
    </div>
  );
}

function TreeItem({
  node,
  currentId,
  programs,
}: {
  node: WorkflowNode;
  currentId?: string;
  programs: Map<string, ProgramInfo>;
}) {
  const isCurrent = currentId !== undefined && node.id === currentId;

  return (
    <li className="tree-item">
      <div className="tree-node" data-current={isCurrent} data-failed={!node.success}>
        <span className="tree-depth">d{node.depth}</span>
        <Hash value={node.id} kind="tx" head={10} tail={8} />
        {isCurrent ? <span className="tag" data-tone="accent">this tx</span> : null}
        {!node.success ? <span className="tag" data-tone="warn">failed</span> : null}
        {node.blockHeight !== null ? (
          <span className="tag">block {groupDigits(node.blockHeight)}</span>
        ) : null}
        <span className="tag">
          {node.instructionCount} {plural(node.instructionCount, "ix")}
        </span>
        {node.programIds.map((id) => (
          <span key={id} className="tag" data-tone="accent" title={id}>
            {programs.get(id)?.label ?? `${id.slice(0, 8)}…`}
          </span>
        ))}
        {node.subscriptions.length > 0 ? (
          <span className="tag">
            {node.subscriptions.length} {plural(node.subscriptions.length, "subscription")}
          </span>
        ) : null}
        <span className="row-time" style={{ marginLeft: "auto" }}>
          {formatUtc(node.timestampMs)}
        </span>
      </div>

      {node.children.length > 0 ? (
        <ul className="tree-list">
          {node.children.map((child) => (
            <TreeItem key={child.id} node={child} currentId={currentId} programs={programs} />
          ))}
        </ul>
      ) : null}

      {node.hasMoreChildren ? (
        <ul className="tree-list">
          <li className="tree-item">
            <div className="tree-node">
              <span className="tag" data-tone="warn">
                more children exist but were not returned by the node
              </span>
            </div>
          </li>
        </ul>
      ) : null}
    </li>
  );
}
