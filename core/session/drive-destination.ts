/** A Drive launch carries a creation destination, never a second file copy. */
export function driveCreationDestination() {
  const params=new URLSearchParams(location.search);
  const organization=params.get('driveOrganization');
  if(!organization || params.has('document'))return {};
  const workspace=params.get('driveWorkspace');
  return {organization,workspace,parent:params.get('driveParent'),scope:workspace?'workspace':'personal'};
}
