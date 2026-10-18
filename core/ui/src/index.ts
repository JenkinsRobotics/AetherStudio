// Aether UI — one widget per file, importable like a class.
// Product-free by rule: widgets take data and emit events; they never
// name a product concept or call an engine verb.
export { Button, type ButtonProps } from "./Button";
export { ParameterRow, type ParameterRowProps } from './ParameterRow';
export { GradientControls, type GradientControlsProps } from './GradientControls';
export { IconButton, type IconButtonProps, type IconButtonSize } from "./IconButton";
export { AetherIcon, registerIconPack, aetherIconNames, type AetherIconName, type AetherIconProps } from "./AetherIcon";
export { Ribbon, RibbonGroup, RibbonTool, type RibbonToolProps } from "./Ribbon";
export { FloatingToolbar, FloatingToolbarMenu, type FloatingToolbarProps, type FloatingToolbarAction, type FloatingToolbarGroup } from "./FloatingToolbar";
export { Rail, RailButton, type RailProps, type RailButtonProps } from "./Rail";
export { TabbedSidebar, type TabbedSidebarProps, type SidebarTab } from "./TabbedSidebar";
export { SidebarDesignMenu, sidebarDesignOptions, type SidebarDesign } from "./SidebarDesignMenu";
export { Tabs, type TabDefinition, type TabsProps } from "./Tabs";
export { Tree, type TreeNode, type TreeProps } from "./Tree";
export { TreePanel, TreeToolbar, type TreePanelProps, type TreeControl } from "./TreePanel";
export { DockPanel, type DockPanelProps } from "./DockPanel";
export { PanelHeading } from "./PanelHeading";
export { TextField, type TextFieldProps } from "./TextField";
export {
  SearchField,
  type SearchFieldProps,
  type SearchFieldScope,
} from "./SearchField";
export {
  Breadcrumbs,
  type BreadcrumbItem,
  type BreadcrumbsProps,
} from "./Breadcrumbs";
export { Dialog, type DialogProps } from "./Dialog";
export { NewFileDialog } from "./NewFileDialog";
export { StatusBar, StatusDot, type StatusKind } from "./StatusBar";
export { ApplicationStatusBar } from "./ApplicationStatusBar";
export { createApplicationStatusBar, updateApplicationStatusBar, type ApplicationStatusProps, type ApplicationConnection } from "./application-status";
export { ViewportCanvas, type ViewportCanvasProps } from "./ViewportCanvas";
export {
  ViewportNavigationCube,
  viewportCubeTransform,
  type StandardViewportView,
  type ViewportNavigationCubeProps,
  type ViewportOrientation,
} from "./ViewportNavigationCube";
export {
  WorkspaceShell,
  FloatingPanel,
  LayoutPresetButton,
  nextLayoutPreset,
  type LayoutPreset,
  type WorkspaceFloatingPosition,
  type WorkspacePanel,
  type WorkspacePanelPresentation,
  type WorkspacePanelState,
  type WorkspaceShellProps,
  type WorkspaceShellHandle,
  type FloatingPanelProps,
} from "./WorkspaceShell";
export { StudioModeButton, WorkspaceWindowMenu, AppearanceToggle, setAetherTheme, activeAetherTheme, installAetherTheme, setAetherViewportTheme, activeAetherViewportTheme, setAetherAppearance, useScopedAetherTheme, type AetherThemeManifest, type AppearanceMode } from "./StudioChrome";
export { aetherThemes, aetherViewportThemes, aetherTheme, resolveTheme, themeCSS, DEFAULT_THEME_ID, type ResolvedTheme } from "./themes";
export { ThemeMenu } from "./ThemeMenu";
export { RibbonWorkspaceShell, type RibbonWorkspaceShellProps } from "./RibbonWorkspaceShell";
export { WorkspaceSwitcher, type WorkspaceSwitcherProps, type WorkspaceSwitcherItem } from "./WorkspaceSwitcher";
export {
  WorkspaceRibbon,
  type WorkspaceRibbonProps,
  type WorkspaceRibbonWorkspace,
  type WorkspaceRibbonCommand,
  type WorkspaceRibbonGroup,
  type WorkspaceRibbonTab,
  type WorkspaceRibbonDensity,
  type WorkspaceRibbonLayout,
  type WorkspaceRibbonAppearance,
  WORKSPACE_RIBBON_DENSITIES,
} from "./WorkspaceRibbon";
export { CollapsibleSidebar, SidebarLabel, SidebarToggle } from "./CollapsibleSidebar";
export { ComingSoonHome } from "./ComingSoonHome";
export { ApplicationWelcome } from "./ApplicationWelcome";
export { DocumentBar, type DocumentBarProps } from "./DocumentBar";
export { Timeline, type TimelineProps, type TimelineTrack } from "./Timeline";
export {
  Menu,
  MenuButton,
  type MenuItem,
  type MenuItemKind,
  type MenuProps,
  type MenuButtonProps,
} from "./Menu";
export { Popover, type PopoverProps } from "./Popover";
export {
  PanelPlacementMenu,
  type PanelPlacement,
  type PanelPlacementMenuProps,
} from "./PanelPlacementMenu";
export type {
  OverlayAnchor,
  OverlayPlacement,
  OverlayPoint,
} from "./overlay-position";
export { NumberField, type NumberFieldProps } from "./NumberField";
export {
  SelectField,
  type SelectFieldOption,
  type SelectFieldProps,
} from "./SelectField";
export { Checkbox, type CheckboxProps } from "./Checkbox";
export {
  RadioGroup,
  type RadioGroupOption,
  type RadioGroupProps,
} from "./RadioGroup";
export {
  SegmentedControl,
  type SegmentedControlOption,
  type SegmentedControlProps,
} from "./SegmentedControl";
export { Slider, type SliderProps } from "./Slider";
export { ColorField, type ColorFieldProps } from "./ColorField";
export { FileField, type FileFieldProps } from "./FileField";
export {
  CommandPalette,
  type CommandPaletteArgument,
  type CommandPaletteCommand,
  type CommandPaletteProps,
} from "./CommandPalette";
export {
  DocumentTabs,
  type DocumentTab,
  type DocumentSplitDirection,
  type DocumentTabsProps,
} from "./DocumentTabs";
export {
  ToastStack,
  type NotificationItem,
  type NotificationKind,
  type ToastStackProps,
} from "./Toast";
export {
  NotificationCenter,
  type NotificationCenterProps,
} from "./NotificationCenter";
export { FieldRow, type FieldRowProps } from "./FieldRow";
export { Inspector, InspectorSection, InspectorActions, type InspectorProps, type InspectorSectionProps } from './Inspector';
export { parseNumberExpression } from "./number-expression";
export { Tooltip, type TooltipProps } from "./Tooltip";
export { EmptyState, type EmptyStateProps } from "./EmptyState";
export { ErrorState, type ErrorStateProps } from "./ErrorState";
export { ProgressOverlay, type ProgressOverlayProps } from "./ProgressOverlay";
export { ListBox, type ListBoxItem, type ListBoxProps } from "./ListBox";
export {
  DataTable,
  type DataTableColumn,
  type DataTableProps,
  type DataTableRowAction,
  type DataTableSort,
} from "./DataTable";
export {
  PropertyGrid,
  type PropertyGridItem,
  type PropertyGridProps,
  type PropertyGridSection,
} from "./PropertyGrid";
export { SplitPane, type SplitPaneProps } from "./SplitPane";
export {
  BottomPanel,
  type BottomPanelProps,
  type BottomPanelTab,
} from "./BottomPanel";

export { AppIcon } from "./AppIcon";
export { AppMark, type AppMarkName, type AppMarkProps } from "./AppMark";
export { AppLauncher, type AppLauncherProps, type LaunchableApp } from "./AppLauncher";

export { ToolIcon, toolIconNames, graphiteToolIconNames, type ToolIconName, type ToolIconProps } from "./ToolIcon";
export { openFeatureWindow, type FeatureWindow, type FeatureWindowOptions } from "./FeatureWindow";
export { createFeatureWindowAccessories, type FeatureWindowHelp } from "./FeatureWindowAccessories";
export { SettingsWindow, SettingsCard, SettingsRow, type SettingsPane, type SettingsSection, type SettingsWindowProps } from "./SettingsWindow";

export { viewportCubeRegions, viewportCubeRegionsForUpAxis, viewportVectorForUpAxis, viewportCubeColorTokens, type ViewportUpAxis, type ViewportCubeRegion, type CubeVector } from "./viewport-cube-geometry";

export { CollectionFilter, type CollectionFilterOption, type CollectionFilterProps } from "./CollectionFilter";
export { OverlayScope } from "./OverlayScope";

export { ToolIconTheme, type ToolIconPack, type ToolIconPalette } from "./ToolIconTheme";

export { FreeCADIcon, freecadIconCatalog, freecadToolIconMap, type FreeCADIconName, type FreeCADToolIconName } from "./FreeCADIcon";

export { IconPackToggle, TOOL_ICON_PACKS } from "./IconPackToggle";

export { parseCSSColor, viewportPalette, readViewportPalette, type ViewportPalette, type ViewportColor, type RGBA } from "./viewport-theme";

export { DashboardShell, type DashboardNavigationGroup } from "./DashboardShell";
export { DashboardCard, DashboardTable, MetricCard, GoalProgress, ActivityList, type DashboardActivity } from "./DashboardCards";
export { DashboardLineChart, DashboardBarChart, type DashboardChartPoint } from "./DashboardCharts";

export { StylePropertiesPanel, type StylePropertiesValue, type StylePropertiesPanelProps } from "./StylePropertiesPanel";

export { RelationEditor, type RelationEditorProps, type RelationEditorValue, type RelationEditorOption } from "./RelationEditor";
export { LayoutStyleControls, defaultLayoutStyle, type LayoutStyleValue } from "./LayoutStyleControls";

export { WorkspaceAgent, type WorkspaceAgentProps } from "./WorkspaceAgent";

export { CircuitSymbol, type CircuitSymbolKind } from "./CircuitSymbol";
export { SignalMonitor, type SignalTrace } from "./SignalMonitor";
export { SharedChromeSettings } from "./SharedChromeSettings";
export { useWorkspaceChrome, setWorkspaceChrome, DEFAULT_WORKSPACE_CHROME, type WorkspaceChromePreferences, type SidebarAttachment } from "./WorkspaceChromePreferences";
export { HarnessConnectorCard, ConnectorFace, ConnectorPreview, HarnessConnectionTable, HarnessDrawingScope } from "./HarnessWidgets";
export type { HarnessPin, HarnessConnectionRow } from "./HarnessWidgets";

export { ApplicationHomeFrame, ApplicationHomeHeader } from "./ApplicationHome";

export { WorkspaceBottomDock, type WorkspaceBottomDockProps } from "./WorkspaceBottomDock";
export { PanelResizeHandle, type PanelResizeHandleProps } from "./PanelResizeHandle";

export { standardWorkspacePanels, STANDARD_WORKSPACE_PANELS, type StandardWorkspacePanelID, type StandardWorkspacePanelBindings } from "./StandardWorkspacePanels";

export { DocumentVersionPanel } from "./DocumentVersionPanel";
export { DocumentCollaborationPanel } from "./DocumentCollaborationPanel";
export type { DocumentConnection, DocumentHistory, DocumentVersionStatus, DocumentCollaboration, CollaborationItem } from "./DocumentServices";
export type { AssistantMessage } from './AssistantPanel';

export { TreePanelSplit, type TreePanelSplitProps } from "./TreePanelSplit";

export { CollectionActions, type CollectionControl } from "./CollectionView";

export { DocumentCreateDialog } from "./DocumentCreateDialog";

export { FileManagerPanel, type FileManagerItem, type FileManagerGroup, type FileManagerPanelProps } from "./FileManagerPanel";
export { DocumentFileManager, type DocumentFileManagerProps } from "./DocumentFileManager";

export { ApplicationFileTable, type ApplicationFileRow, type ApplicationFileColumn } from "./ApplicationFileTable";

export { FILE_TYPES, fileTypeFor, fileTypeDefinition, type FileIdentity, type FileTypeDefinition } from "./file-types";
export { FileTypeFilters } from "./FileTypeFilters";

export { FileIcon } from "./FileIcon";

export { useContextCommands, type ContextCommand } from './context-commands';

export { ApplicationSidebar, SidebarRow, SidebarNavigation, type SidebarItem, type SidebarSection } from "./ApplicationSidebar";
export { ApplicationSettings } from "./ApplicationChrome";
export { DocumentTabBar, type DocumentElementTab } from "./DocumentTabBar";

export { ApplicationUpdates, type ApplicationUpdate } from "./ApplicationUpdates";
export { WorkspaceFileBar } from './WorkspaceFileBar';
export type { WorkspaceFileBarProps } from './WorkspaceFileBar';

export {ApplicationSplash} from "./ApplicationSplash";
export type {ApplicationSplashProps, SplashStage, SplashPhase} from "./ApplicationSplash";

export {ApplicationListHeading, ApplicationListControls} from "./ApplicationList";
export {selectListItems} from "./list-selection";
export {SidebarGroup, WorkspaceIcon} from "./ApplicationSidebar";
export {ListToolMenu} from "./ApplicationList";

export { ToolHelp, type ToolHelpContent } from "./ToolHelp";

export { SelectionIcon } from "./SelectionIcon";

export { InspectionIcon } from "./InspectionIcon";

export { FlowDiagram, FlowDiagramNode, FlowDiagramLabel } from "./FlowDiagram";
export type { FlowDiagramProps, FlowDiagramRoute, FlowDiagramTone, FlowDiagramNodeProps, FlowDiagramLabelProps } from "./FlowDiagram";
export { FlowDiagramEditor, type FlowDiagramEditorProps } from "./FlowDiagramEditor";
export type { FlowDocumentChange, FlowEditOptions } from "./FlowDiagramInspector";
export { parseFlowDocument, flowConnectionPath, flowPortPoint } from "./flow-diagram-model";
export type { FlowDocument, FlowNode, FlowPort, FlowPortSide, FlowConnection, FlowEndpoint, FlowPoint } from "./flow-diagram-model";

export { DocumentRevisionTree } from "./DocumentRevisionTree";
export type { DocumentRevisionTreeProps, RevisionTreeAction, RevisionTreeDraft } from "./DocumentRevisionTree";

export { DocumentList, filterDocumentListItems } from "./DocumentList";
export type { DocumentListProps, DocumentListItem } from "./DocumentList";

export { DimensionedSketch } from "./DimensionedSketch";
export type { DimensionedSketchProps, SketchAnnotationPoint, SketchPresentationEntity, SketchDimensionAnnotation, SketchConstraintAnnotation, SketchAnnotationSelection, SketchAnnotationView } from "./DimensionedSketch";
export { LinkCard, LinkCardGrid } from "./LinkCard";
export * from "./Avatar";
export * from "./PasswordField";
export * from "./ChoiceCard";
export * from "./SettingsLink";
export * from "./StructureStep";
export * from "./AuthenticationForm";
export * from "./PersonalizationForm";
export * from "./BatchActionReview";
export * from "./TemplateEditor";
export * from "./AccountProfile";
export * from "./SubscriptionPicker";
export * from "./FieldMappingForm";
export * from "./TeamMembersPanel";
export * from "./TextVariants";
export * from "./SequenceBrowser";
export * from "./StatusBadge";
export * from "./ChartLegend";
export * from "./ComparisonChart";
export * from "./GaugeChart";
export * from "./RankedList";
export * from "./DashboardNavigation";

export * from "./AppNavigationBar";

export * from "./MediaPreview";
export * from "./ThumbnailPicker";

export { MaterialSwatch, type MaterialSwatchProps } from "./MaterialSwatch";

export { AppWordmark, type AppWordmarkProps, type AppWordmarkName } from "./AppWordmark";

export { AppLayout, APP_LAYOUT_METRICS, type AppLayoutProps } from "./AppLayout";

export * from "./model-studio-presets";
export * from "./TransformFields";
export * from "./SurfacePresetPicker";
export * from "./viewport-pointer-actions";

export { FeatureTree, type FeatureTreeProps } from "./FeatureTree";
export { FeatureTypeIcon, featureTreeActions, featureTreeMenuItems, flattenFeatureItems, DEFAULT_FEATURE_GEOMETRY, type FeatureTreeItem, type FeatureTreeKind, type FeatureTreeCommand, type FeatureTreeRequest } from "./feature-tree";
export { VersionControl, type VersionControlProps, type VersionControlEntry, type VersionControlKind } from "./VersionControl";

export { StudioAppFrame } from "./StudioAppFrame";
export { StudioDocumentBar, type StudioDocumentBarProps } from "./StudioDocumentBar";
export { StudioWorkspace, type StudioWorkspaceProps } from "./StudioWorkspace";
