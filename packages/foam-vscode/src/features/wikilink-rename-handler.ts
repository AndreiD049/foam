import path from 'path';
import { ExtensionContext, workspace } from 'vscode';
import { Foam } from '../core/model/foam';
import { Connection, FoamGraph } from '../core/model/graph';
import { URI } from '../core/model/uri';
import { FoamFeature } from '../types';
import { getText } from '../utils';
import { fromVsCodeUri } from '../utils/vsc-utils';

type Files = { oldUri: URI; newUri: URI };

const isMove = (oldPath: string, newPath: string) =>
  path.parse(oldPath).name.toLowerCase() ===
  path.parse(newPath).name.toLowerCase();

const feature: FoamFeature = {
  activate: async (context: ExtensionContext, foamPromise: Promise<Foam>) => {
    const foam = await foamPromise;

    context.subscriptions.push(
      workspace.onDidRenameFiles(e => {
        e.files.forEach(files => {
          const foamFiles = {
            oldUri: fromVsCodeUri(files.oldUri),
            newUri: fromVsCodeUri(files.newUri),
          };
          handleFileRename(foam, foamFiles);
        });
      })
    );
  },
};

function handleFileRename(foam: Foam, files: Files) {
  if (!foam.graph.backlinks.has(files.oldUri.path)) {
    return;
  }

  const oldResource = foam.workspace.get(files.oldUri);
  const newResource = foam.services.parser.parse(
    files.newUri,
    oldResource.source.text
  );
  foam.workspace.delete(files.oldUri);
  foam.workspace.set(newResource);

  // updateBacklinks(foam, files);
  // updateLinks(foam, files);
}

function updateBacklinks(foam: Foam, files: Files) {
  const backlinks = foam.graph.backlinks.get(files.oldUri.path);
  foam.graph.backlinks.delete(files.oldUri.path);
  foam.graph.backlinks.set(
    files.newUri.path,
    backlinks.map(backlink => ({
      ...backlink,
      target: files.newUri,
    }))
  );
}

function updateLinks(foam: Foam, files: Files) {
  const backlinks = foam.graph.backlinks.get(files.newUri.path);
  // given the backlinks, update all the links with new path too
  backlinks.forEach(backlink => {
    const links = foam.graph.links
      .get(backlink.source.path)
      .filter(
        connection =>
          connection.source.path === backlink.source.path &&
          connection.target.path === files.oldUri.path
      );
    links.forEach(link => {
      link.target = files.newUri;
      if (!isMove(files.oldUri.path, files.newUri.path)) {
        // File name was changed, backlink contents needs to be updated as well
        console.log('Updating link contents');
      }
    });
  });
}

function updateLinkContents(foam: Foam, files: Files) {}

export default feature;
