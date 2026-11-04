import type {
  StartImportFolderRequest,
  StartImportLinkRequest,
  StartImportRequest,
} from "../types";
import { truncateUtf16 } from "./build-import-candidates";
import { type ProposalState, UNFILED_TARGET, getExistingFolderId } from "./proposal-state";

const FILE_NAME_MAX = 255;

type StartRequestBody = Omit<StartImportRequest, "clientRequestId">;

type BuildStartRequestBodyInput = {
  state: ProposalState;
  fileName: string;
};

type BuildStartRequestInput = BuildStartRequestBodyInput & {
  clientRequestId: string;
};

type ClientRequestIdMemo = {
  id: string;
  signature: string;
};

function buildStartRequestBody({ state, fileName }: BuildStartRequestBodyInput): StartRequestBody {
  const newTargets = new Set(state.newFolders.map((folder) => folder.target));
  const links: StartImportLinkRequest[] = [];
  const usedTargets: string[] = [];
  for (const link of state.links) {
    if (link.isRemoved) {
      continue;
    }
    const isKnownTarget =
      link.target !== UNFILED_TARGET &&
      (getExistingFolderId(link.target) != null || newTargets.has(link.target));
    const folderKey = isKnownTarget ? link.target : null;
    if (folderKey && !usedTargets.includes(folderKey)) {
      usedTargets.push(folderKey);
    }
    links.push({
      key: link.key,
      url: link.url,
      title: link.title,
      folderKey,
      createdAt: link.createdAt,
    });
  }

  const folders: StartImportFolderRequest[] = [];
  for (const target of usedTargets) {
    const folderId = getExistingFolderId(target);
    if (folderId != null) {
      folders.push({ key: target, folderId, name: state.existingNames[folderId] ?? "" });
      continue;
    }
    const folder = state.newFolders.find((item) => item.target === target);
    if (folder) {
      folders.push({
        key: target,
        name: folder.name,
        createdAt: folder.origin === "picker" ? null : folder.createdAt,
      });
    }
  }

  return {
    fileName: truncateUtf16(fileName.trim(), FILE_NAME_MAX),
    folders,
    links,
  };
}

function buildStartRequest({
  state,
  clientRequestId,
  fileName,
}: BuildStartRequestInput): StartImportRequest {
  return { clientRequestId, ...buildStartRequestBody({ state, fileName }) };
}

function hashText(text: string, seed: number) {
  let hash = seed >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function getStartRequestSignature(body: StartRequestBody) {
  const text = JSON.stringify(body);
  return `${text.length}:${hashText(text, 0x811c9dc5)}${hashText(text, 0x050c5d1f)}`;
}

function resolveClientRequestId(
  previous: ClientRequestIdMemo | null,
  signature: string,
  createId: () => string,
): ClientRequestIdMemo {
  if (previous && previous.signature === signature) {
    return previous;
  }
  return { id: createId(), signature };
}

export {
  buildStartRequest,
  buildStartRequestBody,
  getStartRequestSignature,
  resolveClientRequestId,
};
export type {
  BuildStartRequestBodyInput,
  BuildStartRequestInput,
  ClientRequestIdMemo,
  StartRequestBody,
};
