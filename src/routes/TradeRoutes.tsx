import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import PageLoadingSkeleton from "@/components/PageLoadingSkeleton";

// Trade / admin portal routes. Split out of App.tsx so none of this code is
// parsed on the public landing pages.
const TradePurgeCache = lazy(() => import("@/pages/TradePurgeCache"));
const TradeLayout = lazy(() => import("@/pages/TradeLayout"));
const TradeGuides = lazy(() => import("@/pages/TradeGuides"));
const TradeGuideDetail = lazy(() => import("@/pages/TradeGuideDetail"));
const TradeGuidesAnalytics = lazy(() => import("@/pages/TradeGuidesAnalytics"));
const TradeErrorBoundary = lazy(() => import("@/components/trade/TradeErrorBoundary"));
const TradeDashboard = lazy(() => import("@/pages/TradeDashboard"));
const TradeAdmin = lazy(() => import("@/pages/TradeAdmin"));
const TradeAdminTools = lazy(() => import("@/pages/TradeAdminTools"));
const TradeAdminDashboard = lazy(() => import("@/pages/TradeAdminDashboard"));
const TradeConciergeUsage = lazy(() => import("@/pages/TradeConciergeUsage"));
const TradeAiUsageDashboard = lazy(() => import("@/pages/TradeAiUsageDashboard"));
const TradeIngestionQueue = lazy(() => import("@/pages/TradeIngestionQueue"));
const TradeRagDebug = lazy(() => import("@/pages/TradeRagDebug"));
const TradeAiUsagePrintCheck = lazy(() => import("@/pages/TradeAiUsagePrintCheck"));
const TradeAdminConciergeLeads = lazy(() => import("@/pages/TradeAdminConciergeLeads"));
const TradeAdminInquiries = lazy(() => import("@/pages/TradeAdminInquiries"));
const TradeAdminCollectorApplications = lazy(() => import("@/pages/TradeAdminCollectorApplications"));
const TradeAdminPortalInvites = lazy(() => import("@/pages/TradeAdminPortalInvites"));
const TradeAdminCnBriefs = lazy(() => import("@/pages/TradeAdminCnBriefs"));
const TradeAdminMcpUsage = lazy(() => import("@/pages/TradeAdminMcpUsage"));
const TradePayoutStatement = lazy(() => import("@/pages/TradePayoutStatement"));
const TradeDescriptionWriter = lazy(() => import("@/pages/TradeDescriptionWriter"));
const TradeRegisteredUsers = lazy(() => import("@/pages/TradeRegisteredUsers"));
const TradeGallery = lazy(() => import("@/pages/TradeGallery"));
const TradeDocuments = lazy(() => import("@/pages/TradeDocuments"));
const TradeDownloadsByCountry = lazy(() => import("@/pages/TradeDownloadsByCountry"));
const TradeQuotes = lazy(() => import("@/pages/TradeQuotes"));
const TradeQuoteReview = lazy(() => import("@/pages/TradeQuoteReview"));
const TradeSettings = lazy(() => import("@/pages/TradeSettings"));
const TradeStudioSettings = lazy(() => import("@/pages/TradeStudioSettings"));
const TradeOrderTimeline = lazy(() => import("@/pages/TradeOrderTimeline"));
const TradeFFESchedule = lazy(() => import("@/pages/TradeFFESchedule"));
const TradeDeliveryTracker = lazy(() => import("@/pages/TradeDeliveryTracker"));
const TradeFFEExportTest = lazy(() => import("@/pages/TradeFFEExportTest"));
const TradeMaterialLibrary = lazy(() => import("@/pages/TradeMaterialLibrary"));
const TradeAxonometric = lazy(() => import("@/pages/TradeAxonometric"));
const TradeTearsheets = lazy(() => import("@/pages/TradeTearsheets"));
const TradeAnnotations = lazy(() => import("@/pages/TradeAnnotations"));
const TradeShippingTracker = lazy(() => import("@/pages/TradeShippingTracker"));
const TradeShippingEstimator = lazy(() => import("@/pages/TradeShippingEstimator"));
const TradeAdminShippingRates = lazy(() => import("@/pages/TradeAdminShippingRates"));
const TradeAdminShippingSurcharges = lazy(() => import("@/pages/TradeAdminShippingSurcharges"));
const TradeAdminTaxonomyAudit = lazy(() => import("@/pages/TradeAdminTaxonomyAudit"));
const TradeAdminDescriptorTaxonomy = lazy(() => import("@/pages/TradeAdminDescriptorTaxonomy"));
const TradeAdminSyncStatus = lazy(() => import("@/pages/TradeAdminSyncStatus"));
const TradeAdminBrandLeadTimes = lazy(() => import("@/pages/TradeAdminBrandLeadTimes"));
const TradeAdminFabrics = lazy(() => import("@/pages/TradeAdminFabrics"));
const TradeAdminBulkFinishes = lazy(() => import("@/pages/TradeAdminBulkFinishes"));
const TradeAdminTiers = lazy(() => import("@/pages/TradeAdminTiers"));
const TradeAdminCadAssets = lazy(() => import("@/pages/TradeAdminCadAssets"));
const TradeAdminGlbModels = lazy(() => import("@/pages/TradeAdminGlbModels"));
const TradeAdminOgPipeline = lazy(() => import("@/pages/TradeAdminOgPipeline"));
const TradeAdminOnboarding = lazy(() => import("@/pages/TradeAdminOnboarding"));
const TradeAdminOnboardingFunnel = lazy(() => import("@/pages/TradeAdminOnboardingFunnel"));
const TradeAdminSharePreview = lazy(() => import("@/pages/TradeAdminSharePreview"));
const TradeAdminHotspotMapping = lazy(() => import("@/pages/TradeAdminHotspotMapping"));
const TradeMoodBoards = lazy(() => import("@/pages/TradeMoodBoards"));
const TradeBudgetTracker = lazy(() => import("@/pages/TradeBudgetTracker"));
const TradeClients = lazy(() => import("@/pages/TradeClients"));
const TradeLeadTimeCalendar = lazy(() => import("@/pages/TradeLeadTimeCalendar"));
const TradeReorder = lazy(() => import("@/pages/TradeReorder"));
const TradeCurrencyConverter = lazy(() => import("@/pages/TradeCurrencyConverter"));
const TradeCPD = lazy(() => import("@/pages/TradeCPD"));
const TradeComparator = lazy(() => import("@/pages/TradeComparator"));
const TradeTools = lazy(() => import("@/pages/TradeTools"));
const TradeShowroom = lazy(() => import("@/pages/TradeShowroom"));
const TradeVisualiser = lazy(() => import("@/pages/TradeVisualiser"));
const TradeSamples = lazy(() => import("@/pages/TradeSamples"));
const TradeJournal = lazy(() => import("@/pages/TradeJournal"));
const TradeProvenance = lazy(() => import("@/pages/TradeProvenance"));
const TradeDocumentsAdmin = lazy(() => import("@/pages/TradeDocumentsAdmin"));
const TradeMediaLibrary = lazy(() => import("@/pages/TradeMediaLibrary"));
const TradeQuotesAdmin = lazy(() => import("@/pages/TradeQuotesAdmin"));
const TradeAxonometricRequests = lazy(() => import("@/pages/TradeAxonometricRequests"));
const TradeCustomRequests = lazy(() => import("@/pages/TradeCustomRequests"));
const TradeFairCalendar = lazy(() => import("@/pages/TradeFairCalendar"));
const TradeAxonometricGallery = lazy(() => import("@/pages/TradeAxonometricGallery"));
const TradePresentations = lazy(() => import("@/pages/TradePresentations"));
const TradePresentationBuilder = lazy(() => import("@/pages/TradePresentationBuilder"));
const TradePresentationViewer = lazy(() => import("@/pages/TradePresentationViewer"));
const TradeFavorites = lazy(() => import("@/pages/TradeFavorites"));
const TradeMyDashboard = lazy(() => import("@/pages/TradeMyDashboard"));
const TradeFavoriteFolderDetail = lazy(() => import("@/pages/TradeFavoriteFolderDetail"));
const TradeFfeTool = lazy(() => import("@/pages/TradeFfeTool"));
const TradeSpatialFit = lazy(() => import("@/pages/TradeSpatialFit"));
const TradeSpatialFitAudit = lazy(() => import("@/pages/TradeSpatialFitAudit"));
const TradeBoards = lazy(() => import("@/pages/TradeBoards"));
const TradeBoardBuilder = lazy(() => import("@/pages/TradeBoardBuilder"));
const TradeProjects = lazy(() => import("@/pages/TradeProjects"));
const TradeProjectDetail = lazy(() => import("@/pages/TradeProjectDetail"));
const TradeInsights = lazy(() => import("@/pages/TradeInsights"));
const TradeDesigners = lazy(() => import("@/pages/TradeDesigners"));
const TradeDesignersAdmin = lazy(() => import("@/pages/TradeDesignersAdmin"));
const TradeCollectiblesAdmin = lazy(() => import("@/pages/TradeCollectiblesAdmin"));
const TradeAdminProductAudit = lazy(() => import("@/pages/TradeAdminProductAudit"));
const TradePriceDriftAudit = lazy(() => import("@/pages/TradePriceDriftAudit"));
const TradeInstagramAudit = lazy(() => import("@/pages/TradeInstagramAudit"));
const TradeAuditLog = lazy(() => import("@/pages/TradeAuditLog"));
const TradeClientProfiles = lazy(() => import("@/pages/TradeClientProfiles"));
const TradeAtelierProfile = lazy(() => import("@/pages/TradeAtelierProfile"));
const TradeAdminDuplicates = lazy(() => import("@/pages/TradeAdminDuplicates"));
const TradeAdminWhatsAppAlerts = lazy(() => import("@/pages/TradeAdminWhatsAppAlerts"));
const TradeAdminFunnelTracker = lazy(() => import("@/pages/TradeAdminFunnelTracker"));
const TradeAdminAxonometricCadQa = lazy(() => import("@/pages/TradeAdminAxonometricCadQa"));
const AdminTradeReview = lazy(() => import("@/pages/AdminTradeReview"));
const ProductPageContainer = lazy(() => import("@/pages/ProductPageContainer"));

export default function TradeRoutes() {
  return (
    <Routes>
      <Route element={<Suspense fallback={<PageLoadingSkeleton />}><TradeErrorBoundary><TradeLayout /></TradeErrorBoundary></Suspense>}>
        <Route index element={<TradeDashboard />} />
        <Route path="dashboard" element={<TradeDashboard />} />
        <Route path="admin" element={<TradeAdmin />} />
        <Route path="admin/trade-review" element={<Suspense fallback={<PageLoadingSkeleton />}><AdminTradeReview /></Suspense>} />
        <Route path="admin/tools" element={<Suspense fallback={<PageLoadingSkeleton />}><TradeAdminTools /></Suspense>} />
        <Route path="admin-dashboard" element={<TradeAdminDashboard />} />
        <Route path="admin/concierge-usage" element={<Suspense fallback={<PageLoadingSkeleton />}><TradeConciergeUsage /></Suspense>} />
        <Route path="admin/ai-usage" element={<Suspense fallback={<PageLoadingSkeleton />}><TradeAiUsageDashboard /></Suspense>} />
        <Route path="admin/ai-usage/print-check" element={<Suspense fallback={<PageLoadingSkeleton />}><TradeAiUsagePrintCheck /></Suspense>} />
        <Route path="admin/ingestion" element={<Suspense fallback={<PageLoadingSkeleton />}><TradeIngestionQueue /></Suspense>} />
        <Route path="admin/rag-debug" element={<Suspense fallback={<PageLoadingSkeleton />}><TradeRagDebug /></Suspense>} />
        <Route path="admin/concierge-leads" element={<Suspense fallback={<PageLoadingSkeleton />}><TradeAdminConciergeLeads /></Suspense>} />
        <Route path="admin/inquiries" element={<Suspense fallback={<PageLoadingSkeleton />}><TradeAdminInquiries /></Suspense>} />
        <Route path="admin/collector-applications" element={<Suspense fallback={<PageLoadingSkeleton />}><TradeAdminCollectorApplications /></Suspense>} />
        <Route path="admin/portal-invites" element={<Suspense fallback={<PageLoadingSkeleton />}><TradeAdminPortalInvites /></Suspense>} />
        <Route path="admin/cn-briefs" element={<Suspense fallback={<PageLoadingSkeleton />}><TradeAdminCnBriefs /></Suspense>} />

        <Route path="admin/mcp-usage" element={<Suspense fallback={<PageLoadingSkeleton />}><TradeAdminMcpUsage /></Suspense>} />

        <Route path="registered-users" element={<TradeRegisteredUsers />} />
        <Route path="description-writer" element={<TradeDescriptionWriter />} />
        <Route path="gallery" element={<TradeGallery />} />
        <Route path="gallery/:slug" element={<TradeGallery />} />
        <Route path="quotes" element={<TradeQuotes />} />
        <Route path="quotes/:quoteId/review" element={<TradeQuoteReview />} />
        <Route path="quotes/:quoteId" element={<TradeQuotes />} />
        <Route path="documents" element={<TradeDocuments />} />
        <Route path="showroom" element={<TradeShowroom />} />
        <Route path="visualiser" element={<Suspense fallback={<PageLoadingSkeleton />}><TradeVisualiser /></Suspense>} />
        <Route path="samples" element={<TradeSamples />} />
        <Route path="journal" element={<TradeJournal />} />
        <Route path="provenance" element={<TradeProvenance />} />
        <Route path="documents-admin" element={<TradeDocumentsAdmin />} />
        <Route path="media" element={<TradeMediaLibrary />} />
        <Route path="quotes-admin" element={<TradeQuotesAdmin />} />
        <Route path="axonometric" element={<Suspense fallback={<PageLoadingSkeleton />}><TradeAxonometric /></Suspense>} />
        <Route path="axonometric-requests" element={<TradeAxonometricRequests />} />
        <Route path="axonometric-gallery" element={<TradeAxonometricGallery />} />
        
        <Route path="presentations" element={<TradePresentations />} />
        <Route path="presentations/:id" element={<TradePresentationBuilder />} />
        <Route path="presentations/:id/view" element={<TradePresentationViewer />} />
        <Route path="favorites" element={<TradeFavorites />} />
        <Route path="me" element={<TradeMyDashboard />} />
        <Route path="favorites/folders/:id" element={<TradeFavoriteFolderDetail />} />
        <Route path="tools/ffe" element={<TradeFfeTool />} />
        <Route path="spatial-fit" element={<TradeSpatialFit />} />
        <Route path="spatial-fit/audit" element={<TradeSpatialFitAudit />} />
        <Route path="insights" element={<TradeInsights />} />
        <Route path="downloads-by-country" element={<TradeDownloadsByCountry />} />
        {/* magazine-analytics route removed — AD free-download flow discontinued */}
        <Route path="designers" element={<TradeDesigners />} />
        <Route path="designers/admin" element={<TradeDesignersAdmin />} />
        <Route path="collectibles/admin" element={<TradeCollectiblesAdmin />} />
        <Route path="admin/purge-cache" element={<Suspense fallback={<PageLoadingSkeleton />}><TradePurgeCache /></Suspense>} />
        <Route path="admin/product-audit" element={<Suspense fallback={<PageLoadingSkeleton />}><TradeAdminProductAudit /></Suspense>} />
        <Route path="admin/price-drift" element={<Suspense fallback={<PageLoadingSkeleton />}><TradePriceDriftAudit /></Suspense>} />
        <Route path="designers/instagram" element={<TradeInstagramAudit />} />
        <Route path="designers/:slug" element={<TradeAtelierProfile />} />
        <Route path="products/:id" element={<Suspense fallback={<PageLoadingSkeleton />}><ProductPageContainer isInsideTradePortal /></Suspense>} />
        <Route path="products/:slug/:productSlug" element={<Suspense fallback={<PageLoadingSkeleton />}><ProductPageContainer isInsideTradePortal /></Suspense>} />
        <Route path="boards" element={<TradeBoards />} />
        <Route path="boards/:id" element={<TradeBoardBuilder />} />
        <Route path="projects" element={<TradeProjects />} />
        <Route path="projects/:id" element={<TradeProjectDetail />} />
        {/* spec-sheet moved to public route */}
        <Route path="audit-log" element={<TradeAuditLog />} />
        <Route path="client-profiles" element={<TradeClientProfiles />} />
        <Route path="order-timeline" element={<TradeOrderTimeline />} />
        <Route path="ffe-schedule" element={<TradeFFESchedule />} />
        <Route path="delivery-tracker" element={<TradeDeliveryTracker />} />
        <Route path="ffe-export-test" element={<TradeFFEExportTest />} />
        <Route path="materials" element={<TradeMaterialLibrary />} />
        <Route path="tearsheets" element={<TradeTearsheets />} />
        <Route path="annotations" element={<TradeAnnotations />} />
        <Route path="shipping-tracker" element={<TradeShippingTracker />} />
        <Route path="shipping-estimator" element={<TradeShippingEstimator />} />
        <Route path="admin/shipping-rates" element={<TradeAdminShippingRates />} />
        <Route path="admin/shipping-surcharges" element={<TradeAdminShippingSurcharges />} />
        <Route path="admin/taxonomy-audit" element={<TradeAdminTaxonomyAudit />} />
        <Route path="admin/descriptor-taxonomy" element={<Suspense fallback={<PageLoadingSkeleton />}><TradeAdminDescriptorTaxonomy /></Suspense>} />
        <Route path="admin/duplicates" element={<TradeAdminDuplicates />} />
        <Route path="admin/whatsapp-alerts" element={<Suspense fallback={<PageLoadingSkeleton />}><TradeAdminWhatsAppAlerts /></Suspense>} />
        <Route path="admin/funnel-tracker" element={<Suspense fallback={<PageLoadingSkeleton />}><TradeAdminFunnelTracker /></Suspense>} />
        <Route path="admin/axonometric-cad-qa" element={<TradeAdminAxonometricCadQa />} />
        <Route path="admin/sync-status" element={<TradeAdminSyncStatus />} />
        <Route path="admin/brand-lead-times" element={<TradeAdminBrandLeadTimes />} />
        <Route path="admin/fabrics" element={<TradeAdminFabrics />} />
        <Route path="admin/bulk-finishes" element={<TradeAdminBulkFinishes />} />
        <Route path="admin/tiers" element={<TradeAdminTiers />} />
        <Route path="admin/cad-assets" element={<TradeAdminCadAssets />} />
        <Route path="admin/glb-models" element={<TradeAdminGlbModels />} />
        <Route path="admin/og-pipeline" element={<TradeAdminOgPipeline />} />
        <Route path="admin/onboarding" element={<TradeAdminOnboarding />} />
        <Route path="admin/onboarding-funnel" element={<TradeAdminOnboardingFunnel />} />
        <Route path="payouts" element={<Suspense fallback={<PageLoadingSkeleton />}><TradePayoutStatement /></Suspense>} />
        
        <Route path="admin/share-preview" element={<TradeAdminSharePreview />} />
        <Route path="admin/hotspot-mapping" element={<Suspense fallback={<PageLoadingSkeleton />}><TradeAdminHotspotMapping /></Suspense>} />
        <Route path="mood-boards" element={<TradeMoodBoards />} />
        <Route path="budget" element={<TradeBudgetTracker />} />
        <Route path="clients" element={<TradeClients />} />
        <Route path="lead-time-calendar" element={<TradeLeadTimeCalendar />} />
        <Route path="reorder" element={<TradeReorder />} />
        <Route path="currency-converter" element={<TradeCurrencyConverter />} />
        <Route path="cpd" element={<TradeCPD />} />
        <Route path="comparator" element={<TradeComparator />} />
        <Route path="tools" element={<TradeTools />} />
        
        <Route path="guides" element={<TradeGuides />} />
        <Route path="guides/analytics" element={<TradeGuidesAnalytics />} />
        <Route path="guides/:slug" element={<TradeGuideDetail />} />
        <Route path="custom-requests" element={<TradeCustomRequests />} />
        <Route path="calendar" element={<TradeFairCalendar />} />
        <Route path="settings" element={<TradeSettings />} />
        <Route path="settings/studio" element={<TradeStudioSettings />} />
      </Route>
    </Routes>
  );
}
