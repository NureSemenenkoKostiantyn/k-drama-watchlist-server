import type { MediaFriendContextResponse } from "../common/types/friend-context.types";
import type {
  FriendshipResponse,
  FriendshipsResponse,
} from "../common/types/friendship.types";
import type { LibraryEntryResponse } from "../common/types/library.types";
import type {
  MediaDetails,
  MediaSearchResponse,
  MediaSummary,
} from "../common/types/media.types";
import type {
  PublicSharedListDetailsResponse,
  PublicSharedListDiscoveryResponse,
  SharedListDetailsResponse,
  SharedListInviteResponse,
  SharedListItemResponse,
  SharedListMemberResponse,
  SharedListPendingInviteResponse,
  SharedListResponse,
} from "../common/types/shared-list.types";
import type { StatisticsOverviewResponse } from "../common/types/statistics.types";
import type {
  TelegramConnectionResponse,
  TelegramLinkResponse,
} from "../common/types/telegram.types";
import type {
  SuggestionResponse,
  SuggestionsResponse,
} from "../common/types/suggestion.types";
import type {
  PublicWheelDetailsResponse,
  WheelDetailsResponse,
  WheelItemResponse,
  WheelMemberResponse,
  WheelResponse,
  WheelSpinHistoryResponse,
  WheelSpinResponse,
} from "../common/types/wheel.types";
import type { CreateFriendRequestDto } from "../modules/friends/dto/create-friend-request.dto";
import type { AddLibraryEntryDto } from "../modules/library/dto/add-library-entry.dto";
import type { UpdateLibraryEntryDto } from "../modules/library/dto/update-library-entry.dto";
import type { UpdateLibraryStatusDto } from "../modules/library/dto/update-library-status.dto";
import type { UpdatePlaybackPreferenceDto } from "../modules/library/dto/update-playback-preference.dto";
import type { UpdateProgressDto } from "../modules/library/dto/update-progress.dto";
import type { UpdateRatingDto } from "../modules/library/dto/update-rating.dto";
import type { AddSharedListItemDto } from "../modules/shared-lists/dto/add-shared-list-item.dto";
import type { CreateSharedListDto } from "../modules/shared-lists/dto/create-shared-list.dto";
import type { CreateSharedListInviteDto } from "../modules/shared-lists/dto/create-shared-list-invite.dto";
import type { ReorderSharedListItemsDto } from "../modules/shared-lists/dto/reorder-shared-list-items.dto";
import type { UpdateSharedListDto } from "../modules/shared-lists/dto/update-shared-list.dto";
import type { UpdateSharedListItemDto } from "../modules/shared-lists/dto/update-shared-list-item.dto";
import type { UpdateSharedListMemberDto } from "../modules/shared-lists/dto/update-shared-list-member.dto";
import type { CreateSuggestionDto } from "../modules/suggestions/dto/create-suggestion.dto";
import type { AddWheelItemDto } from "../modules/wheels/dto/add-wheel-item.dto";
import type { AddWheelMemberDto } from "../modules/wheels/dto/add-wheel-member.dto";
import type { CreateWheelDto } from "../modules/wheels/dto/create-wheel.dto";
import type { ReorderWheelItemsDto } from "../modules/wheels/dto/reorder-wheel-items.dto";
import type { UpdateWheelDto } from "../modules/wheels/dto/update-wheel.dto";
import type { UpdateWheelItemDto } from "../modules/wheels/dto/update-wheel-item.dto";
import type { UpdateWheelMemberDto } from "../modules/wheels/dto/update-wheel-member.dto";

/**
 * Root used to generate the public OpenAPI components consumed by the Angular
 * application. Only HTTP request and public-safe response types belong here;
 * database documents and internal service types must never be referenced.
 */
export interface PublicApiContract {
  mediaSummary: MediaSummary;
  mediaDetails: MediaDetails;
  mediaSearchResponse: MediaSearchResponse;
  mediaFriendContextResponse: MediaFriendContextResponse;

  libraryEntryResponse: LibraryEntryResponse;
  addLibraryEntryRequest: AddLibraryEntryDto;
  updateLibraryEntryRequest: UpdateLibraryEntryDto;
  updateLibraryStatusRequest: UpdateLibraryStatusDto;
  updateProgressRequest: UpdateProgressDto;
  updateRatingRequest: UpdateRatingDto;
  updatePlaybackPreferenceRequest: UpdatePlaybackPreferenceDto;

  statisticsOverviewResponse: StatisticsOverviewResponse;

  telegramConnectionResponse: TelegramConnectionResponse;
  telegramLinkResponse: TelegramLinkResponse;

  friendshipResponse: FriendshipResponse;
  friendshipsResponse: FriendshipsResponse;
  createFriendRequest: CreateFriendRequestDto;

  suggestionResponse: SuggestionResponse;
  suggestionsResponse: SuggestionsResponse;
  createSuggestionRequest: CreateSuggestionDto;

  sharedListResponse: SharedListResponse;
  sharedListDetailsResponse: SharedListDetailsResponse;
  sharedListMemberResponse: SharedListMemberResponse;
  sharedListItemResponse: SharedListItemResponse;
  sharedListInviteResponse: SharedListInviteResponse;
  sharedListPendingInviteResponse: SharedListPendingInviteResponse;
  publicSharedListDetailsResponse: PublicSharedListDetailsResponse;
  publicSharedListDiscoveryResponse: PublicSharedListDiscoveryResponse;
  createSharedListRequest: CreateSharedListDto;
  updateSharedListRequest: UpdateSharedListDto;
  createSharedListInviteRequest: CreateSharedListInviteDto;
  updateSharedListMemberRequest: UpdateSharedListMemberDto;
  addSharedListItemRequest: AddSharedListItemDto;
  updateSharedListItemRequest: UpdateSharedListItemDto;
  reorderSharedListItemsRequest: ReorderSharedListItemsDto;

  wheelResponse: WheelResponse;
  wheelDetailsResponse: WheelDetailsResponse;
  wheelItemResponse: WheelItemResponse;
  wheelMemberResponse: WheelMemberResponse;
  wheelSpinResponse: WheelSpinResponse;
  wheelSpinHistoryResponse: WheelSpinHistoryResponse;
  publicWheelDetailsResponse: PublicWheelDetailsResponse;
  createWheelRequest: CreateWheelDto;
  updateWheelRequest: UpdateWheelDto;
  addWheelMemberRequest: AddWheelMemberDto;
  updateWheelMemberRequest: UpdateWheelMemberDto;
  addWheelItemRequest: AddWheelItemDto;
  updateWheelItemRequest: UpdateWheelItemDto;
  reorderWheelItemsRequest: ReorderWheelItemsDto;
}
