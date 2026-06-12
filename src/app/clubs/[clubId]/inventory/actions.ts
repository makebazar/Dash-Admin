"use server";

export type { Category, HandoverSourceCandidate, Inventory, InventoryAccessScope, InventoryItem, InventoryPostCloseCorrection, PriceTagSettings, PriceTagTemplate, ProcurementCandidate, ProcurementMode, Product, ReplenishmentRule, SalarySaleCandidate, ShiftAccountabilitySetupStatus, ShiftReceipt, ShiftReceiptItem, ShiftReceiptPaymentType, ShiftSaleItem, ShiftZoneDiscrepancyRow, ShiftZoneOverview, ShiftZoneOverviewShift, ShiftZoneOverviewZone, ShiftZoneSnapshotDraftItem, ShiftZoneSnapshotType, Supplier, Supply, SupplyItem, Warehouse } from "./actions/types";

import { calculateAnalytics as _calculateAnalytics, getAbcAnalysisData as _getAbcAnalysisData, getClubSettings as _getClubSettings, getMetrics as _getMetrics, getSalesAnalytics as _getSalesAnalytics } from "./actions/analytics";
import { assertSessionUserCanAccessClub as _assertSessionUserCanAccessClub, assertUserCanAccessClub as _assertUserCanAccessClub, assertUserCanUseWarehouses as _assertUserCanUseWarehouses, getInventoryAccessScope as _getInventoryAccessScope, getInventoryPageAccess as _getInventoryPageAccess, getUserRoleInClub as _getUserRoleInClub, normalizeAllowedWarehouseIds as _normalizeAllowedWarehouseIds, requireClubAccess as _requireClubAccess, requireSessionUserId as _requireSessionUserId, resolveEffectiveEmployeeWarehouseIds as _resolveEffectiveEmployeeWarehouseIds } from "./actions/auth";
import { createCategory as _createCategory, deleteCategory as _deleteCategory, getCategories as _getCategories, updateCategory as _updateCategory } from "./actions/categories";
import { addProductToInventory as _addProductToInventory, addProductToInventorySafe as _addProductToInventorySafe, bulkUpdateInventoryItems as _bulkUpdateInventoryItems, bulkUpdateInventoryItemsSafe as _bulkUpdateInventoryItemsSafe, calculateInventoryDelta as _calculateInventoryDelta, cancelInventory as _cancelInventory, closeInventory as _closeInventory, closeInventorySafe as _closeInventorySafe, correctInventoryItem as _correctInventoryItem, createInventory as _createInventory, createInventorySafe as _createInventorySafe, deleteInventory as _deleteInventory, getClubInventorySettingsInternal as _getClubInventorySettingsInternal, getInventories as _getInventories, getInventory as _getInventory, getInventoryItems as _getInventoryItems, getInventoryMovementDuringCount as _getInventoryMovementDuringCount, getInventoryPostCloseCorrections as _getInventoryPostCloseCorrections, getOpenShiftInventory as _getOpenShiftInventory, normalizeInventoryActualStock as _normalizeInventoryActualStock, updateInventoryItem as _updateInventoryItem, updateInventorySettings as _updateInventorySettings } from "./actions/inventories";
import { archiveProduct as _archiveProduct, assertProductBelongsToClub as _assertProductBelongsToClub, assertProductsBelongToClub as _assertProductsBelongToClub, bulkUpdatePrices as _bulkUpdatePrices, createProduct as _createProduct, deleteProduct as _deleteProduct, getProduct as _getProduct, getProductByBarcode as _getProductByBarcode, getProductDeletionStatus as _getProductDeletionStatus, getProductHistory as _getProductHistory, getProductPriceHistory as _getProductPriceHistory, getProducts as _getProducts, getProductsSafe as _getProductsSafe, restoreProduct as _restoreProduct, updateProduct as _updateProduct } from "./actions/products";
import { buildShiftReceiptsFromRows as _buildShiftReceiptsFromRows, bulkAccruePromoSafe as _bulkAccruePromoSafe, claimPromoItemSafe as _claimPromoItemSafe, confirmPlayerVisitSafe as _confirmPlayerVisitSafe, createManualSale as _createManualSale, createShiftReceipt as _createShiftReceipt, createShiftReceiptSafe as _createShiftReceiptSafe, getActionErrorMessage as _getActionErrorMessage, getClubPromoSettings as _getClubPromoSettings, getInventoryShiftReceipts as _getInventoryShiftReceipts, getPendingQuestVerifications as _getPendingQuestVerifications, getPromoQueue as _getPromoQueue, getRecentPromoAccruals as _getRecentPromoAccruals, getShiftReceipts as _getShiftReceipts, resolvePosWarehouseIdForItems as _resolvePosWarehouseIdForItems, resolvePosWarehousesForItems as _resolvePosWarehousesForItems, returnReceiptItem as _returnReceiptItem, returnReceiptItemSafe as _returnReceiptItemSafe, verifyQuestSafe as _verifyQuestSafe, voidPromoAccrualSafe as _voidPromoAccrualSafe, voidShiftReceipt as _voidShiftReceipt, voidShiftReceiptSafe as _voidShiftReceiptSafe } from "./actions/receipts";
import { addProductToProcurementList as _addProductToProcurementList, bulkUpdateProcurementItems as _bulkUpdateProcurementItems, calculateSuggestedProcurementQuantity as _calculateSuggestedProcurementQuantity, checkReplenishmentNeeds as _checkReplenishmentNeeds, completeTask as _completeTask, createReplenishmentRule as _createReplenishmentRule, deleteProcurementItem as _deleteProcurementItem, deleteProcurementList as _deleteProcurementList, deleteReplenishmentRule as _deleteReplenishmentRule, generateProcurementList as _generateProcurementList, getClubTasks as _getClubTasks, getProcurementCandidate as _getProcurementCandidate, getProcurementCoverDays as _getProcurementCoverDays, getProcurementListById as _getProcurementListById, getProcurementListItems as _getProcurementListItems, getProcurementLists as _getProcurementLists, getProcurementPriority as _getProcurementPriority, getProcurementReason as _getProcurementReason, getReplenishmentRules as _getReplenishmentRules, getReplenishmentRulesForProduct as _getReplenishmentRulesForProduct, manualTriggerReplenishment as _manualTriggerReplenishment, normalizeProcurementBoxSize as _normalizeProcurementBoxSize, updateProcurementItem as _updateProcurementItem } from "./actions/replenishment";
import { ensurePreviousShiftClosureCompleted as _ensurePreviousShiftClosureCompleted, findAcceptedFromShift as _findAcceptedFromShift, getActiveShiftsForClub as _getActiveShiftsForClub, getEmployees as _getEmployees, getHandoverSourceCandidates as _getHandoverSourceCandidates, getHandoverSourceCandidatesSafe as _getHandoverSourceCandidatesSafe, getShiftForZoneAccountability as _getShiftForZoneAccountability, getShiftZoneDiscrepancyReport as _getShiftZoneDiscrepancyReport, getShiftZoneDiscrepancyReportInternal as _getShiftZoneDiscrepancyReportInternal, getShiftZoneOverview as _getShiftZoneOverview, getShiftZoneSnapshotDraft as _getShiftZoneSnapshotDraft, getShiftZoneSnapshotDraftSafe as _getShiftZoneSnapshotDraftSafe, hasSavedShiftZoneSnapshot as _hasSavedShiftZoneSnapshot, normalizeShiftZoneKey as _normalizeShiftZoneKey, saveShiftZoneSnapshot as _saveShiftZoneSnapshot, saveShiftZoneSnapshotSafe as _saveShiftZoneSnapshotSafe } from "./actions/shifts";
import { adjustWarehouseStock as _adjustWarehouseStock, applyWarehouseStockDelta as _applyWarehouseStockDelta, assertWarehouseBelongsToClub as _assertWarehouseBelongsToClub, assignShiftToMovement as _assignShiftToMovement, correctStockMovement as _correctStockMovement, createTransfer as _createTransfer, createTransferSafe as _createTransferSafe, createWriteOff as _createWriteOff, createWriteOffSafe as _createWriteOffSafe, deleteStockMovement as _deleteStockMovement, getLockedWarehouseStock as _getLockedWarehouseStock, getSalarySaleCandidates as _getSalarySaleCandidates, getSalarySaleCandidatesInternal as _getSalarySaleCandidatesInternal, getStockMovements as _getStockMovements, logStockMovement as _logStockMovement, massAssignShiftToMovements as _massAssignShiftToMovements, syncProductsCurrentStock as _syncProductsCurrentStock, transferStock as _transferStock, writeOffProduct as _writeOffProduct } from "./actions/stock";
import { createSupplier as _createSupplier, createSupply as _createSupply, createSupplySafe as _createSupplySafe, deleteSupply as _deleteSupply, getSuppliers as _getSuppliers, getSuppliersForSelect as _getSuppliersForSelect, getSupplies as _getSupplies, getSupplyById as _getSupplyById, getSupplyItems as _getSupplyItems } from "./actions/suppliers";
import { createWarehouse as _createWarehouse, deleteWarehouse as _deleteWarehouse, getShiftAccountabilitySetupStatus as _getShiftAccountabilitySetupStatus, getShiftAccountabilityWarehouses as _getShiftAccountabilityWarehouses, getShiftAccountabilityWarehousesInternal as _getShiftAccountabilityWarehousesInternal, getShiftAccountabilityWarehousesSafe as _getShiftAccountabilityWarehousesSafe, getWarehouses as _getWarehouses, updateWarehouse as _updateWarehouse } from "./actions/warehouses";

export async function calculateAnalytics(...args: Parameters<typeof _calculateAnalytics>): Promise<ReturnType<typeof _calculateAnalytics>> {
  return (_calculateAnalytics as any)(...args);
}

export async function getAbcAnalysisData(...args: Parameters<typeof _getAbcAnalysisData>): Promise<ReturnType<typeof _getAbcAnalysisData>> {
  return (_getAbcAnalysisData as any)(...args);
}

export async function getClubSettings(...args: Parameters<typeof _getClubSettings>): Promise<ReturnType<typeof _getClubSettings>> {
  return (_getClubSettings as any)(...args);
}

export async function getMetrics(...args: Parameters<typeof _getMetrics>): Promise<ReturnType<typeof _getMetrics>> {
  return (_getMetrics as any)(...args);
}

export async function getSalesAnalytics(...args: Parameters<typeof _getSalesAnalytics>): Promise<ReturnType<typeof _getSalesAnalytics>> {
  return (_getSalesAnalytics as any)(...args);
}

export async function assertSessionUserCanAccessClub(...args: Parameters<typeof _assertSessionUserCanAccessClub>): Promise<ReturnType<typeof _assertSessionUserCanAccessClub>> {
  return (_assertSessionUserCanAccessClub as any)(...args);
}

export async function assertUserCanAccessClub(...args: Parameters<typeof _assertUserCanAccessClub>): Promise<ReturnType<typeof _assertUserCanAccessClub>> {
  return (_assertUserCanAccessClub as any)(...args);
}

export async function assertUserCanUseWarehouses(...args: Parameters<typeof _assertUserCanUseWarehouses>): Promise<ReturnType<typeof _assertUserCanUseWarehouses>> {
  return (_assertUserCanUseWarehouses as any)(...args);
}

export async function getInventoryAccessScope(...args: Parameters<typeof _getInventoryAccessScope>): Promise<ReturnType<typeof _getInventoryAccessScope>> {
  return (_getInventoryAccessScope as any)(...args);
}

export async function getInventoryPageAccess(...args: Parameters<typeof _getInventoryPageAccess>): Promise<ReturnType<typeof _getInventoryPageAccess>> {
  return (_getInventoryPageAccess as any)(...args);
}

export async function getUserRoleInClub(...args: Parameters<typeof _getUserRoleInClub>): Promise<ReturnType<typeof _getUserRoleInClub>> {
  return (_getUserRoleInClub as any)(...args);
}

export async function normalizeAllowedWarehouseIds(...args: Parameters<typeof _normalizeAllowedWarehouseIds>): Promise<ReturnType<typeof _normalizeAllowedWarehouseIds>> {
  return (_normalizeAllowedWarehouseIds as any)(...args);
}

export async function requireClubAccess(...args: Parameters<typeof _requireClubAccess>): Promise<ReturnType<typeof _requireClubAccess>> {
  return (_requireClubAccess as any)(...args);
}

export async function requireSessionUserId(...args: Parameters<typeof _requireSessionUserId>): Promise<ReturnType<typeof _requireSessionUserId>> {
  return (_requireSessionUserId as any)(...args);
}

export async function resolveEffectiveEmployeeWarehouseIds(...args: Parameters<typeof _resolveEffectiveEmployeeWarehouseIds>): Promise<ReturnType<typeof _resolveEffectiveEmployeeWarehouseIds>> {
  return (_resolveEffectiveEmployeeWarehouseIds as any)(...args);
}

export async function createCategory(...args: Parameters<typeof _createCategory>): Promise<ReturnType<typeof _createCategory>> {
  return (_createCategory as any)(...args);
}

export async function deleteCategory(...args: Parameters<typeof _deleteCategory>): Promise<ReturnType<typeof _deleteCategory>> {
  return (_deleteCategory as any)(...args);
}

export async function getCategories(...args: Parameters<typeof _getCategories>): Promise<ReturnType<typeof _getCategories>> {
  return (_getCategories as any)(...args);
}

export async function updateCategory(...args: Parameters<typeof _updateCategory>): Promise<ReturnType<typeof _updateCategory>> {
  return (_updateCategory as any)(...args);
}

export async function addProductToInventory(...args: Parameters<typeof _addProductToInventory>): Promise<ReturnType<typeof _addProductToInventory>> {
  return (_addProductToInventory as any)(...args);
}

export async function addProductToInventorySafe(...args: Parameters<typeof _addProductToInventorySafe>): Promise<ReturnType<typeof _addProductToInventorySafe>> {
  return (_addProductToInventorySafe as any)(...args);
}

export async function bulkUpdateInventoryItems(...args: Parameters<typeof _bulkUpdateInventoryItems>): Promise<ReturnType<typeof _bulkUpdateInventoryItems>> {
  return (_bulkUpdateInventoryItems as any)(...args);
}

export async function bulkUpdateInventoryItemsSafe(...args: Parameters<typeof _bulkUpdateInventoryItemsSafe>): Promise<ReturnType<typeof _bulkUpdateInventoryItemsSafe>> {
  return (_bulkUpdateInventoryItemsSafe as any)(...args);
}

export async function calculateInventoryDelta(...args: Parameters<typeof _calculateInventoryDelta>): Promise<ReturnType<typeof _calculateInventoryDelta>> {
  return (_calculateInventoryDelta as any)(...args);
}

export async function cancelInventory(...args: Parameters<typeof _cancelInventory>): Promise<ReturnType<typeof _cancelInventory>> {
  return (_cancelInventory as any)(...args);
}

export async function closeInventory(...args: Parameters<typeof _closeInventory>): Promise<ReturnType<typeof _closeInventory>> {
  return (_closeInventory as any)(...args);
}

export async function closeInventorySafe(...args: Parameters<typeof _closeInventorySafe>): Promise<ReturnType<typeof _closeInventorySafe>> {
  return (_closeInventorySafe as any)(...args);
}

export async function correctInventoryItem(...args: Parameters<typeof _correctInventoryItem>): Promise<ReturnType<typeof _correctInventoryItem>> {
  return (_correctInventoryItem as any)(...args);
}

export async function createInventory(...args: Parameters<typeof _createInventory>): Promise<ReturnType<typeof _createInventory>> {
  return (_createInventory as any)(...args);
}

export async function createInventorySafe(...args: Parameters<typeof _createInventorySafe>): Promise<ReturnType<typeof _createInventorySafe>> {
  return (_createInventorySafe as any)(...args);
}

export async function deleteInventory(...args: Parameters<typeof _deleteInventory>): Promise<ReturnType<typeof _deleteInventory>> {
  return (_deleteInventory as any)(...args);
}

export async function getClubInventorySettingsInternal(...args: Parameters<typeof _getClubInventorySettingsInternal>): Promise<ReturnType<typeof _getClubInventorySettingsInternal>> {
  return (_getClubInventorySettingsInternal as any)(...args);
}

export async function getInventories(...args: Parameters<typeof _getInventories>): Promise<ReturnType<typeof _getInventories>> {
  return (_getInventories as any)(...args);
}

export async function getInventory(...args: Parameters<typeof _getInventory>): Promise<ReturnType<typeof _getInventory>> {
  return (_getInventory as any)(...args);
}

export async function getInventoryItems(...args: Parameters<typeof _getInventoryItems>): Promise<ReturnType<typeof _getInventoryItems>> {
  return (_getInventoryItems as any)(...args);
}

export async function getInventoryMovementDuringCount(...args: Parameters<typeof _getInventoryMovementDuringCount>): Promise<ReturnType<typeof _getInventoryMovementDuringCount>> {
  return (_getInventoryMovementDuringCount as any)(...args);
}

export async function getInventoryPostCloseCorrections(...args: Parameters<typeof _getInventoryPostCloseCorrections>): Promise<ReturnType<typeof _getInventoryPostCloseCorrections>> {
  return (_getInventoryPostCloseCorrections as any)(...args);
}

export async function getOpenShiftInventory(...args: Parameters<typeof _getOpenShiftInventory>): Promise<ReturnType<typeof _getOpenShiftInventory>> {
  return (_getOpenShiftInventory as any)(...args);
}

export async function normalizeInventoryActualStock(...args: Parameters<typeof _normalizeInventoryActualStock>): Promise<ReturnType<typeof _normalizeInventoryActualStock>> {
  return (_normalizeInventoryActualStock as any)(...args);
}

export async function updateInventoryItem(...args: Parameters<typeof _updateInventoryItem>): Promise<ReturnType<typeof _updateInventoryItem>> {
  return (_updateInventoryItem as any)(...args);
}

export async function updateInventorySettings(...args: Parameters<typeof _updateInventorySettings>): Promise<ReturnType<typeof _updateInventorySettings>> {
  return (_updateInventorySettings as any)(...args);
}

export async function archiveProduct(...args: Parameters<typeof _archiveProduct>): Promise<ReturnType<typeof _archiveProduct>> {
  return (_archiveProduct as any)(...args);
}

export async function assertProductBelongsToClub(...args: Parameters<typeof _assertProductBelongsToClub>): Promise<ReturnType<typeof _assertProductBelongsToClub>> {
  return (_assertProductBelongsToClub as any)(...args);
}

export async function assertProductsBelongToClub(...args: Parameters<typeof _assertProductsBelongToClub>): Promise<ReturnType<typeof _assertProductsBelongToClub>> {
  return (_assertProductsBelongToClub as any)(...args);
}

export async function bulkUpdatePrices(...args: Parameters<typeof _bulkUpdatePrices>): Promise<ReturnType<typeof _bulkUpdatePrices>> {
  return (_bulkUpdatePrices as any)(...args);
}

export async function createProduct(...args: Parameters<typeof _createProduct>): Promise<ReturnType<typeof _createProduct>> {
  return (_createProduct as any)(...args);
}

export async function deleteProduct(...args: Parameters<typeof _deleteProduct>): Promise<ReturnType<typeof _deleteProduct>> {
  return (_deleteProduct as any)(...args);
}

export async function getProduct(...args: Parameters<typeof _getProduct>): Promise<ReturnType<typeof _getProduct>> {
  return (_getProduct as any)(...args);
}

export async function getProductByBarcode(...args: Parameters<typeof _getProductByBarcode>): Promise<ReturnType<typeof _getProductByBarcode>> {
  return (_getProductByBarcode as any)(...args);
}

export async function getProductDeletionStatus(...args: Parameters<typeof _getProductDeletionStatus>): Promise<ReturnType<typeof _getProductDeletionStatus>> {
  return (_getProductDeletionStatus as any)(...args);
}

export async function getProductHistory(...args: Parameters<typeof _getProductHistory>): Promise<ReturnType<typeof _getProductHistory>> {
  return (_getProductHistory as any)(...args);
}

export async function getProductPriceHistory(...args: Parameters<typeof _getProductPriceHistory>): Promise<ReturnType<typeof _getProductPriceHistory>> {
  return (_getProductPriceHistory as any)(...args);
}

export async function getProducts(...args: Parameters<typeof _getProducts>): Promise<ReturnType<typeof _getProducts>> {
  return (_getProducts as any)(...args);
}

export async function getProductsSafe(...args: Parameters<typeof _getProductsSafe>): Promise<ReturnType<typeof _getProductsSafe>> {
  return (_getProductsSafe as any)(...args);
}

export async function restoreProduct(...args: Parameters<typeof _restoreProduct>): Promise<ReturnType<typeof _restoreProduct>> {
  return (_restoreProduct as any)(...args);
}

export async function updateProduct(...args: Parameters<typeof _updateProduct>): Promise<ReturnType<typeof _updateProduct>> {
  return (_updateProduct as any)(...args);
}

export async function buildShiftReceiptsFromRows(...args: Parameters<typeof _buildShiftReceiptsFromRows>): Promise<ReturnType<typeof _buildShiftReceiptsFromRows>> {
  return (_buildShiftReceiptsFromRows as any)(...args);
}

export async function bulkAccruePromoSafe(...args: Parameters<typeof _bulkAccruePromoSafe>): Promise<ReturnType<typeof _bulkAccruePromoSafe>> {
  return (_bulkAccruePromoSafe as any)(...args);
}

export async function claimPromoItemSafe(...args: Parameters<typeof _claimPromoItemSafe>): Promise<ReturnType<typeof _claimPromoItemSafe>> {
  return (_claimPromoItemSafe as any)(...args);
}

export async function confirmPlayerVisitSafe(...args: Parameters<typeof _confirmPlayerVisitSafe>): Promise<ReturnType<typeof _confirmPlayerVisitSafe>> {
  return (_confirmPlayerVisitSafe as any)(...args);
}

export async function createManualSale(...args: Parameters<typeof _createManualSale>): Promise<ReturnType<typeof _createManualSale>> {
  return (_createManualSale as any)(...args);
}

export async function createShiftReceipt(...args: Parameters<typeof _createShiftReceipt>): Promise<ReturnType<typeof _createShiftReceipt>> {
  return (_createShiftReceipt as any)(...args);
}

export async function createShiftReceiptSafe(...args: Parameters<typeof _createShiftReceiptSafe>): Promise<ReturnType<typeof _createShiftReceiptSafe>> {
  return (_createShiftReceiptSafe as any)(...args);
}

export async function getActionErrorMessage(...args: Parameters<typeof _getActionErrorMessage>): Promise<ReturnType<typeof _getActionErrorMessage>> {
  return (_getActionErrorMessage as any)(...args);
}

export async function getClubPromoSettings(...args: Parameters<typeof _getClubPromoSettings>): Promise<ReturnType<typeof _getClubPromoSettings>> {
  return (_getClubPromoSettings as any)(...args);
}

export async function getInventoryShiftReceipts(...args: Parameters<typeof _getInventoryShiftReceipts>): Promise<ReturnType<typeof _getInventoryShiftReceipts>> {
  return (_getInventoryShiftReceipts as any)(...args);
}

export async function getPendingQuestVerifications(...args: Parameters<typeof _getPendingQuestVerifications>): Promise<ReturnType<typeof _getPendingQuestVerifications>> {
  return (_getPendingQuestVerifications as any)(...args);
}

export async function getPromoQueue(...args: Parameters<typeof _getPromoQueue>): Promise<ReturnType<typeof _getPromoQueue>> {
  return (_getPromoQueue as any)(...args);
}

export async function getRecentPromoAccruals(...args: Parameters<typeof _getRecentPromoAccruals>): Promise<ReturnType<typeof _getRecentPromoAccruals>> {
  return (_getRecentPromoAccruals as any)(...args);
}

export async function getShiftReceipts(...args: Parameters<typeof _getShiftReceipts>): Promise<ReturnType<typeof _getShiftReceipts>> {
  return (_getShiftReceipts as any)(...args);
}

export async function resolvePosWarehouseIdForItems(...args: Parameters<typeof _resolvePosWarehouseIdForItems>): Promise<ReturnType<typeof _resolvePosWarehouseIdForItems>> {
  return (_resolvePosWarehouseIdForItems as any)(...args);
}

export async function resolvePosWarehousesForItems(...args: Parameters<typeof _resolvePosWarehousesForItems>): Promise<ReturnType<typeof _resolvePosWarehousesForItems>> {
  return (_resolvePosWarehousesForItems as any)(...args);
}

export async function returnReceiptItem(...args: Parameters<typeof _returnReceiptItem>): Promise<ReturnType<typeof _returnReceiptItem>> {
  return (_returnReceiptItem as any)(...args);
}

export async function returnReceiptItemSafe(...args: Parameters<typeof _returnReceiptItemSafe>): Promise<ReturnType<typeof _returnReceiptItemSafe>> {
  return (_returnReceiptItemSafe as any)(...args);
}

export async function verifyQuestSafe(...args: Parameters<typeof _verifyQuestSafe>): Promise<ReturnType<typeof _verifyQuestSafe>> {
  return (_verifyQuestSafe as any)(...args);
}

export async function voidPromoAccrualSafe(...args: Parameters<typeof _voidPromoAccrualSafe>): Promise<ReturnType<typeof _voidPromoAccrualSafe>> {
  return (_voidPromoAccrualSafe as any)(...args);
}

export async function voidShiftReceipt(...args: Parameters<typeof _voidShiftReceipt>): Promise<ReturnType<typeof _voidShiftReceipt>> {
  return (_voidShiftReceipt as any)(...args);
}

export async function voidShiftReceiptSafe(...args: Parameters<typeof _voidShiftReceiptSafe>): Promise<ReturnType<typeof _voidShiftReceiptSafe>> {
  return (_voidShiftReceiptSafe as any)(...args);
}

export async function addProductToProcurementList(...args: Parameters<typeof _addProductToProcurementList>): Promise<ReturnType<typeof _addProductToProcurementList>> {
  return (_addProductToProcurementList as any)(...args);
}

export async function bulkUpdateProcurementItems(...args: Parameters<typeof _bulkUpdateProcurementItems>): Promise<ReturnType<typeof _bulkUpdateProcurementItems>> {
  return (_bulkUpdateProcurementItems as any)(...args);
}

export async function calculateSuggestedProcurementQuantity(...args: Parameters<typeof _calculateSuggestedProcurementQuantity>): Promise<ReturnType<typeof _calculateSuggestedProcurementQuantity>> {
  return (_calculateSuggestedProcurementQuantity as any)(...args);
}

export async function checkReplenishmentNeeds(...args: Parameters<typeof _checkReplenishmentNeeds>): Promise<ReturnType<typeof _checkReplenishmentNeeds>> {
  return (_checkReplenishmentNeeds as any)(...args);
}

export async function completeTask(...args: Parameters<typeof _completeTask>): Promise<ReturnType<typeof _completeTask>> {
  return (_completeTask as any)(...args);
}

export async function createReplenishmentRule(...args: Parameters<typeof _createReplenishmentRule>): Promise<ReturnType<typeof _createReplenishmentRule>> {
  return (_createReplenishmentRule as any)(...args);
}

export async function deleteProcurementItem(...args: Parameters<typeof _deleteProcurementItem>): Promise<ReturnType<typeof _deleteProcurementItem>> {
  return (_deleteProcurementItem as any)(...args);
}

export async function deleteProcurementList(...args: Parameters<typeof _deleteProcurementList>): Promise<ReturnType<typeof _deleteProcurementList>> {
  return (_deleteProcurementList as any)(...args);
}

export async function deleteReplenishmentRule(...args: Parameters<typeof _deleteReplenishmentRule>): Promise<ReturnType<typeof _deleteReplenishmentRule>> {
  return (_deleteReplenishmentRule as any)(...args);
}

export async function generateProcurementList(...args: Parameters<typeof _generateProcurementList>): Promise<ReturnType<typeof _generateProcurementList>> {
  return (_generateProcurementList as any)(...args);
}

export async function getClubTasks(...args: Parameters<typeof _getClubTasks>): Promise<ReturnType<typeof _getClubTasks>> {
  return (_getClubTasks as any)(...args);
}

export async function getProcurementCandidate(...args: Parameters<typeof _getProcurementCandidate>): Promise<ReturnType<typeof _getProcurementCandidate>> {
  return (_getProcurementCandidate as any)(...args);
}

export async function getProcurementCoverDays(...args: Parameters<typeof _getProcurementCoverDays>): Promise<ReturnType<typeof _getProcurementCoverDays>> {
  return (_getProcurementCoverDays as any)(...args);
}

export async function getProcurementListById(...args: Parameters<typeof _getProcurementListById>): Promise<ReturnType<typeof _getProcurementListById>> {
  return (_getProcurementListById as any)(...args);
}

export async function getProcurementListItems(...args: Parameters<typeof _getProcurementListItems>): Promise<ReturnType<typeof _getProcurementListItems>> {
  return (_getProcurementListItems as any)(...args);
}

export async function getProcurementLists(...args: Parameters<typeof _getProcurementLists>): Promise<ReturnType<typeof _getProcurementLists>> {
  return (_getProcurementLists as any)(...args);
}

export async function getProcurementPriority(...args: Parameters<typeof _getProcurementPriority>): Promise<ReturnType<typeof _getProcurementPriority>> {
  return (_getProcurementPriority as any)(...args);
}

export async function getProcurementReason(...args: Parameters<typeof _getProcurementReason>): Promise<ReturnType<typeof _getProcurementReason>> {
  return (_getProcurementReason as any)(...args);
}

export async function getReplenishmentRules(...args: Parameters<typeof _getReplenishmentRules>): Promise<ReturnType<typeof _getReplenishmentRules>> {
  return (_getReplenishmentRules as any)(...args);
}

export async function getReplenishmentRulesForProduct(...args: Parameters<typeof _getReplenishmentRulesForProduct>): Promise<ReturnType<typeof _getReplenishmentRulesForProduct>> {
  return (_getReplenishmentRulesForProduct as any)(...args);
}

export async function manualTriggerReplenishment(...args: Parameters<typeof _manualTriggerReplenishment>): Promise<ReturnType<typeof _manualTriggerReplenishment>> {
  return (_manualTriggerReplenishment as any)(...args);
}

export async function normalizeProcurementBoxSize(...args: Parameters<typeof _normalizeProcurementBoxSize>): Promise<ReturnType<typeof _normalizeProcurementBoxSize>> {
  return (_normalizeProcurementBoxSize as any)(...args);
}

export async function updateProcurementItem(...args: Parameters<typeof _updateProcurementItem>): Promise<ReturnType<typeof _updateProcurementItem>> {
  return (_updateProcurementItem as any)(...args);
}

export async function ensurePreviousShiftClosureCompleted(...args: Parameters<typeof _ensurePreviousShiftClosureCompleted>): Promise<ReturnType<typeof _ensurePreviousShiftClosureCompleted>> {
  return (_ensurePreviousShiftClosureCompleted as any)(...args);
}

export async function findAcceptedFromShift(...args: Parameters<typeof _findAcceptedFromShift>): Promise<ReturnType<typeof _findAcceptedFromShift>> {
  return (_findAcceptedFromShift as any)(...args);
}

export async function getActiveShiftsForClub(...args: Parameters<typeof _getActiveShiftsForClub>): Promise<ReturnType<typeof _getActiveShiftsForClub>> {
  return (_getActiveShiftsForClub as any)(...args);
}

export async function getEmployees(...args: Parameters<typeof _getEmployees>): Promise<ReturnType<typeof _getEmployees>> {
  return (_getEmployees as any)(...args);
}

export async function getHandoverSourceCandidates(...args: Parameters<typeof _getHandoverSourceCandidates>): Promise<ReturnType<typeof _getHandoverSourceCandidates>> {
  return (_getHandoverSourceCandidates as any)(...args);
}

export async function getHandoverSourceCandidatesSafe(...args: Parameters<typeof _getHandoverSourceCandidatesSafe>): Promise<ReturnType<typeof _getHandoverSourceCandidatesSafe>> {
  return (_getHandoverSourceCandidatesSafe as any)(...args);
}

export async function getShiftForZoneAccountability(...args: Parameters<typeof _getShiftForZoneAccountability>): Promise<ReturnType<typeof _getShiftForZoneAccountability>> {
  return (_getShiftForZoneAccountability as any)(...args);
}

export async function getShiftZoneDiscrepancyReport(...args: Parameters<typeof _getShiftZoneDiscrepancyReport>): Promise<ReturnType<typeof _getShiftZoneDiscrepancyReport>> {
  return (_getShiftZoneDiscrepancyReport as any)(...args);
}

export async function getShiftZoneDiscrepancyReportInternal(...args: Parameters<typeof _getShiftZoneDiscrepancyReportInternal>): Promise<ReturnType<typeof _getShiftZoneDiscrepancyReportInternal>> {
  return (_getShiftZoneDiscrepancyReportInternal as any)(...args);
}

export async function getShiftZoneOverview(...args: Parameters<typeof _getShiftZoneOverview>): Promise<ReturnType<typeof _getShiftZoneOverview>> {
  return (_getShiftZoneOverview as any)(...args);
}

export async function getShiftZoneSnapshotDraft(...args: Parameters<typeof _getShiftZoneSnapshotDraft>): Promise<ReturnType<typeof _getShiftZoneSnapshotDraft>> {
  return (_getShiftZoneSnapshotDraft as any)(...args);
}

export async function getShiftZoneSnapshotDraftSafe(...args: Parameters<typeof _getShiftZoneSnapshotDraftSafe>): Promise<ReturnType<typeof _getShiftZoneSnapshotDraftSafe>> {
  return (_getShiftZoneSnapshotDraftSafe as any)(...args);
}

export async function hasSavedShiftZoneSnapshot(...args: Parameters<typeof _hasSavedShiftZoneSnapshot>): Promise<ReturnType<typeof _hasSavedShiftZoneSnapshot>> {
  return (_hasSavedShiftZoneSnapshot as any)(...args);
}

export async function normalizeShiftZoneKey(...args: Parameters<typeof _normalizeShiftZoneKey>): Promise<ReturnType<typeof _normalizeShiftZoneKey>> {
  return (_normalizeShiftZoneKey as any)(...args);
}

export async function saveShiftZoneSnapshot(...args: Parameters<typeof _saveShiftZoneSnapshot>): Promise<ReturnType<typeof _saveShiftZoneSnapshot>> {
  return (_saveShiftZoneSnapshot as any)(...args);
}

export async function saveShiftZoneSnapshotSafe(...args: Parameters<typeof _saveShiftZoneSnapshotSafe>): Promise<ReturnType<typeof _saveShiftZoneSnapshotSafe>> {
  return (_saveShiftZoneSnapshotSafe as any)(...args);
}

export async function adjustWarehouseStock(...args: Parameters<typeof _adjustWarehouseStock>): Promise<ReturnType<typeof _adjustWarehouseStock>> {
  return (_adjustWarehouseStock as any)(...args);
}

export async function applyWarehouseStockDelta(...args: Parameters<typeof _applyWarehouseStockDelta>): Promise<ReturnType<typeof _applyWarehouseStockDelta>> {
  return (_applyWarehouseStockDelta as any)(...args);
}

export async function assertWarehouseBelongsToClub(...args: Parameters<typeof _assertWarehouseBelongsToClub>): Promise<ReturnType<typeof _assertWarehouseBelongsToClub>> {
  return (_assertWarehouseBelongsToClub as any)(...args);
}

export async function assignShiftToMovement(...args: Parameters<typeof _assignShiftToMovement>): Promise<ReturnType<typeof _assignShiftToMovement>> {
  return (_assignShiftToMovement as any)(...args);
}

export async function correctStockMovement(...args: Parameters<typeof _correctStockMovement>): Promise<ReturnType<typeof _correctStockMovement>> {
  return (_correctStockMovement as any)(...args);
}

export async function createTransfer(...args: Parameters<typeof _createTransfer>): Promise<ReturnType<typeof _createTransfer>> {
  return (_createTransfer as any)(...args);
}

export async function createTransferSafe(...args: Parameters<typeof _createTransferSafe>): Promise<ReturnType<typeof _createTransferSafe>> {
  return (_createTransferSafe as any)(...args);
}

export async function createWriteOff(...args: Parameters<typeof _createWriteOff>): Promise<ReturnType<typeof _createWriteOff>> {
  return (_createWriteOff as any)(...args);
}

export async function createWriteOffSafe(...args: Parameters<typeof _createWriteOffSafe>): Promise<ReturnType<typeof _createWriteOffSafe>> {
  return (_createWriteOffSafe as any)(...args);
}

export async function deleteStockMovement(...args: Parameters<typeof _deleteStockMovement>): Promise<ReturnType<typeof _deleteStockMovement>> {
  return (_deleteStockMovement as any)(...args);
}

export async function getLockedWarehouseStock(...args: Parameters<typeof _getLockedWarehouseStock>): Promise<ReturnType<typeof _getLockedWarehouseStock>> {
  return (_getLockedWarehouseStock as any)(...args);
}

export async function getSalarySaleCandidates(...args: Parameters<typeof _getSalarySaleCandidates>): Promise<ReturnType<typeof _getSalarySaleCandidates>> {
  return (_getSalarySaleCandidates as any)(...args);
}

export async function getSalarySaleCandidatesInternal(...args: Parameters<typeof _getSalarySaleCandidatesInternal>): Promise<ReturnType<typeof _getSalarySaleCandidatesInternal>> {
  return (_getSalarySaleCandidatesInternal as any)(...args);
}

export async function getStockMovements(...args: Parameters<typeof _getStockMovements>): Promise<ReturnType<typeof _getStockMovements>> {
  return (_getStockMovements as any)(...args);
}

export async function logStockMovement(...args: Parameters<typeof _logStockMovement>): Promise<ReturnType<typeof _logStockMovement>> {
  return (_logStockMovement as any)(...args);
}

export async function massAssignShiftToMovements(...args: Parameters<typeof _massAssignShiftToMovements>): Promise<ReturnType<typeof _massAssignShiftToMovements>> {
  return (_massAssignShiftToMovements as any)(...args);
}

export async function syncProductsCurrentStock(...args: Parameters<typeof _syncProductsCurrentStock>): Promise<ReturnType<typeof _syncProductsCurrentStock>> {
  return (_syncProductsCurrentStock as any)(...args);
}

export async function transferStock(...args: Parameters<typeof _transferStock>): Promise<ReturnType<typeof _transferStock>> {
  return (_transferStock as any)(...args);
}

export async function writeOffProduct(...args: Parameters<typeof _writeOffProduct>): Promise<ReturnType<typeof _writeOffProduct>> {
  return (_writeOffProduct as any)(...args);
}

export async function createSupplier(...args: Parameters<typeof _createSupplier>): Promise<ReturnType<typeof _createSupplier>> {
  return (_createSupplier as any)(...args);
}

export async function createSupply(...args: Parameters<typeof _createSupply>): Promise<ReturnType<typeof _createSupply>> {
  return (_createSupply as any)(...args);
}

export async function createSupplySafe(...args: Parameters<typeof _createSupplySafe>): Promise<ReturnType<typeof _createSupplySafe>> {
  return (_createSupplySafe as any)(...args);
}

export async function deleteSupply(...args: Parameters<typeof _deleteSupply>): Promise<ReturnType<typeof _deleteSupply>> {
  return (_deleteSupply as any)(...args);
}

export async function getSuppliers(...args: Parameters<typeof _getSuppliers>): Promise<ReturnType<typeof _getSuppliers>> {
  return (_getSuppliers as any)(...args);
}

export async function getSuppliersForSelect(...args: Parameters<typeof _getSuppliersForSelect>): Promise<ReturnType<typeof _getSuppliersForSelect>> {
  return (_getSuppliersForSelect as any)(...args);
}

export async function getSupplies(...args: Parameters<typeof _getSupplies>): Promise<ReturnType<typeof _getSupplies>> {
  return (_getSupplies as any)(...args);
}

export async function getSupplyById(...args: Parameters<typeof _getSupplyById>): Promise<ReturnType<typeof _getSupplyById>> {
  return (_getSupplyById as any)(...args);
}

export async function getSupplyItems(...args: Parameters<typeof _getSupplyItems>): Promise<ReturnType<typeof _getSupplyItems>> {
  return (_getSupplyItems as any)(...args);
}

export async function createWarehouse(...args: Parameters<typeof _createWarehouse>): Promise<ReturnType<typeof _createWarehouse>> {
  return (_createWarehouse as any)(...args);
}

export async function deleteWarehouse(...args: Parameters<typeof _deleteWarehouse>): Promise<ReturnType<typeof _deleteWarehouse>> {
  return (_deleteWarehouse as any)(...args);
}

export async function getShiftAccountabilitySetupStatus(...args: Parameters<typeof _getShiftAccountabilitySetupStatus>): Promise<ReturnType<typeof _getShiftAccountabilitySetupStatus>> {
  return (_getShiftAccountabilitySetupStatus as any)(...args);
}

export async function getShiftAccountabilityWarehouses(...args: Parameters<typeof _getShiftAccountabilityWarehouses>): Promise<ReturnType<typeof _getShiftAccountabilityWarehouses>> {
  return (_getShiftAccountabilityWarehouses as any)(...args);
}

export async function getShiftAccountabilityWarehousesInternal(...args: Parameters<typeof _getShiftAccountabilityWarehousesInternal>): Promise<ReturnType<typeof _getShiftAccountabilityWarehousesInternal>> {
  return (_getShiftAccountabilityWarehousesInternal as any)(...args);
}

export async function getShiftAccountabilityWarehousesSafe(...args: Parameters<typeof _getShiftAccountabilityWarehousesSafe>): Promise<ReturnType<typeof _getShiftAccountabilityWarehousesSafe>> {
  return (_getShiftAccountabilityWarehousesSafe as any)(...args);
}

export async function getWarehouses(...args: Parameters<typeof _getWarehouses>): Promise<ReturnType<typeof _getWarehouses>> {
  return (_getWarehouses as any)(...args);
}

export async function updateWarehouse(...args: Parameters<typeof _updateWarehouse>): Promise<ReturnType<typeof _updateWarehouse>> {
  return (_updateWarehouse as any)(...args);
}

