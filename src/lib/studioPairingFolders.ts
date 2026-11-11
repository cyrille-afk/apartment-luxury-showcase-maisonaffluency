import { supabase } from "@/integrations/supabase/client";

export type PairingFolder = { id: string; title: string };
export type StudioFolderPlacement = { itemId: string; folderId: string; folderTitle: string; finish: string | null; locked: boolean };

export async function moveStudioPiece(projectId: string, itemId: string, sourceFolderId: string, destinationFolderId: string) {
  if (!destinationFolderId || destinationFolderId === sourceFolderId) throw new Error("Choose a different project sub-folder.");
  const { data: folders, error: folderError } = await supabase.from("client_boards").select("id, title")
    .eq("project_id", projectId).in("id", [sourceFolderId, destinationFolderId]);
  const destination = folders?.find(folder => folder.id === destinationFolderId);
  if (folderError || !destination || !folders?.some(folder => folder.id === sourceFolderId)) throw new Error("Both sub-folders must belong to the active project.");
  const { data: item, error: itemError } = await supabase.from("client_board_items")
    .select("id, procurement_quote_id, source_quote_item_id").eq("id", itemId).eq("board_id", sourceFolderId).single();
  if (itemError || !item) throw new Error("This saved piece could not be opened. Please refresh and try again.");
  if (item.procurement_quote_id || item.source_quote_item_id) throw new Error("This piece is linked to a quote and cannot be moved here.");
  const { data: moved, error } = await supabase.from("client_board_items").update({ board_id: destinationFolderId, subfolder: null })
    .eq("id", item.id).eq("board_id", sourceFolderId).is("procurement_quote_id", null).is("source_quote_item_id", null)
    .select("id, board_id").single();
  if (error || !moved || moved.board_id !== destinationFolderId) throw new Error("The piece could not be moved. Its original folder has been kept.");
  return destination;
}

export async function listPairingFolders(projectId: string, productId: string) {
  const folders: PairingFolder[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from("client_boards").select("id, title")
      .eq("project_id", projectId).order("created_at", { ascending: false }).range(offset, offset + 499);
    if (error) throw new Error("Project folders could not be loaded. Please try again.");
    folders.push(...(data || []));
    if (!data || data.length < 500) break;
  }
  const saved = new Set<string>();
  for (let offset = 0; offset < folders.length; offset += 100) {
    const { data, error } = await supabase.from("client_board_items").select("board_id")
      .eq("product_id", productId).in("board_id", folders.slice(offset, offset + 100).map(folder => folder.id));
    if (error) throw new Error("Saved folder selections could not be checked. Please try again.");
    for (const item of data || []) saved.add(item.board_id);
  }
  return { folders, saved };
}

export async function createPairingFolder(projectId: string, name: string): Promise<PairingFolder> {
  const title = name.trim();
  if (!title) throw new Error("Enter a sub-folder name.");
  const { data: identity, error: authError } = await supabase.auth.getUser();
  if (authError || !identity.user) throw new Error("Please sign in again to create a sub-folder.");
  const { data: project, error: projectError } = await supabase.from("projects").select("id, studio_id").eq("id", projectId).single();
  if (projectError || !project) throw new Error("This project could not be opened. Please try again.");
  const { data, error } = await supabase.from("client_boards").insert({ project_id: project.id, studio_id: project.studio_id,
    user_id: identity.user.id, title, client_name: "" }).select("id, title").single();
  if (error || !data) throw new Error("The sub-folder could not be created. Please try again.");
  return data;
}

export async function savePairingToFolder(projectId: string, folderId: string, productId: string): Promise<PairingFolder> {
  if (!folderId) throw new Error("Select a project sub-folder first.");
  const { data: folder, error: folderError } = await supabase.from("client_boards").select("id, title")
    .eq("id", folderId).eq("project_id", projectId).single();
  if (folderError || !folder) throw new Error("This sub-folder is not available in the active project.");
  const { data: existing, error: existingError } = await supabase.from("client_board_items").select("id")
    .eq("board_id", folder.id).eq("product_id", productId).limit(1).maybeSingle();
  if (existingError) throw new Error("This folder could not be checked. Please try again.");
  if (!existing) {
    const { data: last, error: orderError } = await supabase.from("client_board_items").select("sort_order")
      .eq("board_id", folder.id).order("sort_order", { ascending: false }).limit(1);
    if (orderError) throw new Error("This folder could not be checked. Please try again.");
    const { data: saved, error } = await supabase.from("client_board_items")
      .insert({ board_id: folder.id, product_id: productId, sort_order: (last?.[0]?.sort_order ?? -1) + 1 }).select("id").single();
    if (error || !saved) throw new Error("The piece could not be saved to this sub-folder. Please try again.");
  }
  return folder;
}