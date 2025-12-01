from fastapi import APIRouter, HTTPException

from models.base import GeneralResponse
from models.settings import SettingsChangeCluster
from services.search_service import search_service

router = APIRouter(prefix="/settings", tags=["settings"])


@router.post("/change-cluster", response_model=GeneralResponse)
async def change_cluster(request: SettingsChangeCluster):
    """
    Change the clustering mode for a previous search state.
    
    This allows switching between moment, video, and video_avg modes
    without re-running the entire search.
    """
    try:
        # Change clustering mode using the dedicated service method
        new_state_id, clusters = await search_service.change_clustering_mode(
            request.state_id, 
            request.mode
        )
           
        return GeneralResponse(
            status="success",
            mode=request.mode,
            state_id=new_state_id,
            results=clusters  # Results would be re-clustered according to new mode
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 