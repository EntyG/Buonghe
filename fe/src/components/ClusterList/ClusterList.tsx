import React, { useState, useEffect, useRef } from "react";
import { ClusterResult, ClusterMode, ImageItem, VideoGroup } from "../../types";
import ClusterCard from "../ClusterCard/ClusterCard";
import { ListWrapper } from "./ClusterList.styles";
import { Modal, Box, Typography, IconButton, Dialog, DialogTitle, DialogContent, Button } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import { getListClusterImages, BASE_IMAGE_URL, getRelatedImages } from "../../api";
import ImageCard from "../ImageCard/ImageCard";
import { enhanceImagesWithVideoInfo } from "../../utils/videoUtils";
import { frameToMs } from "../../utils/keyframeMap";

interface Props {
  clusters: ClusterResult[];
  mode: ClusterMode;
  stateId?: string;
  model?: string;
  feedbackMap: Map<string, 'positive' | 'negative'>;
  onFeedbackChange: (imageId: string, feedbackType: 'positive' | 'negative' | null) => void;
}

const ClusterList: React.FC<Props> = ({ 
  clusters, 
  mode, 
  stateId, 
  model,
  feedbackMap,
  onFeedbackChange
}) => {
  // State for popup image
  const [open, setOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{
    image: ImageItem;
    clusterName: string;
  } | null>(null);

  const [isOpeningVideo, setIsOpeningVideo] = useState(false);

  // Navigation state for dialog
  const [navigableImages, setNavigableImages] = useState<{ image: ImageItem; clusterName: string }[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const filmstripRef = useRef<HTMLDivElement>(null);

  const handleImageClick = (image: ImageItem, clusterName: string) => {
    const cluster = clusters.find((c) => c.cluster_name === clusterName);
    const imageWithUrl = { ...(image as any), clusterUrl: cluster?.url } as ImageItem & { clusterUrl?: string };
    
    let navImages: { image: ImageItem; clusterName: string }[] = [];
    let clickedIndex = 0;

    if (mode === "moment") {
      // In moment mode, all images from all clusters are navigable
      navImages = allImages;
      clickedIndex = allImages.findIndex(item => item.image.id === image.id);
    } else if (mode === "video" || mode === "timeline") {
      // In video/timeline mode, only images from the same cluster/video are navigable
      navImages = allImages.filter(item => item.clusterName === clusterName);
      clickedIndex = navImages.findIndex(item => item.image.id === image.id);
    } else {
      // Default: use all images
      navImages = allImages;
      clickedIndex = allImages.findIndex(item => item.image.id === image.id);
    }

    if (clickedIndex === -1) clickedIndex = 0;

    setNavigableImages(navImages);
    setCurrentIndex(clickedIndex);
    setSelectedImage({ image: imageWithUrl, clusterName });
    setOpen(true);
  };

  // Navigate to previous image
  const handlePrevImage = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      const item = navigableImages[newIndex];
      const cluster = clusters.find((c) => c.cluster_name === item.clusterName);
      const imageWithUrl = { ...(item.image as any), clusterUrl: cluster?.url } as ImageItem & { clusterUrl?: string };
      setSelectedImage({ image: imageWithUrl, clusterName: item.clusterName });
    }
  };

  // Navigate to next image
  const handleNextImage = () => {
    if (currentIndex < navigableImages.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      const item = navigableImages[newIndex];
      const cluster = clusters.find((c) => c.cluster_name === item.clusterName);
      const imageWithUrl = { ...(item.image as any), clusterUrl: cluster?.url } as ImageItem & { clusterUrl?: string };
      setSelectedImage({ image: imageWithUrl, clusterName: item.clusterName });
    }
  };

  // Handle clicking on a thumbnail in the filmstrip
  const handleThumbnailClick = (index: number) => {
    setCurrentIndex(index);
    const item = navigableImages[index];
    const cluster = clusters.find((c) => c.cluster_name === item.clusterName);
    const imageWithUrl = { ...(item.image as any), clusterUrl: cluster?.url } as ImageItem & { clusterUrl?: string };
    setSelectedImage({ image: imageWithUrl, clusterName: item.clusterName });
  };

  // Scroll filmstrip to center the current image
  useEffect(() => {
    if (open && filmstripRef.current && navigableImages.length > 0) {
      const container = filmstripRef.current;
      const thumbnailWidth = 120; // Width of thumbnail + gap
      const containerWidth = container.clientWidth;
      const scrollPosition = (currentIndex * thumbnailWidth) - (containerWidth / 2) + (thumbnailWidth / 2);
      
      container.scrollTo({
        left: scrollPosition,
        behavior: 'smooth'
      });
    }
  }, [currentIndex, open, navigableImages.length]);
  const handleClose = () => setOpen(false);

  const handleNextFrame = async () => {
    if (!selectedImage) return;
    try {
      // normalize image id to format '/<cluster>/<frame>'
      let rawId = (selectedImage.image.id || "").toString();
      const clusterName = selectedImage.clusterName;
      // if contains duplicate cluster, try to extract the tail like 'L27_V001/001313'
      const tailMatch = rawId.match(/([A-Za-z0-9]+_V\d+\/\d+)$/);
      let imageIdParam = rawId;
      if (tailMatch) {
        imageIdParam = `/${tailMatch[1]}`;
      } else if (!rawId.startsWith("/")) {
        // if rawId is like 'L27_V001/001313' or '001313', ensure it starts with '/'
        if (rawId.includes("/")) imageIdParam = `/${rawId}`;
        else imageIdParam = `/${clusterName}/${rawId}`;
      }

      const resp = await getRelatedImages("timeline", imageIdParam);
      const clustersResp: any[] = resp?.results || [];
      const frames: { image: ImageItem; clusterName: string }[] = [];
      clustersResp.forEach((c) => {
        (c.image_list || []).forEach((img: any) => {
          const path = img.path ? `${BASE_IMAGE_URL}/${img.path}${img.id}.webp` : `${BASE_IMAGE_URL}/${img.id}.webp`;
          // attempt to derive a frameNumber from id (e.g. 'L23_V025/016121' -> 016121)
          let frameNumber: number | undefined = undefined;
          const rawId = (img.id || '').toString().replace(/^\/+/, '');
          const parts = rawId.split('/');
          const last = parts[parts.length - 1] || '';
          if (/^\d+$/.test(last)) {
            frameNumber = parseInt(last, 10);
          }

          frames.push({ image: { id: img.id, path, name: img.name, time: img.time_in_seconds, score: img.score, frameNumber } as ImageItem, clusterName: c.cluster_name });
        });
      });
      setRelatedFrames(frames);
      setRelatedDialogOpen(true);
    } catch (e) {
      console.error("Failed to fetch related frames", e);
    }
  };
    const [allImages, setAllImages] = useState<{ image: ImageItem; clusterName: string }[]>([]);

  const [videoGroups, setVideoGroups] = useState<VideoGroup[]>([]);

  // Video dialog state for 'View All' per video
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [selectedVideoGroup, setSelectedVideoGroup] = useState<VideoGroup | null>(null);

  const handleVideoExpand = (group: VideoGroup) => {
    setSelectedVideoGroup(group);
    setVideoDialogOpen(true);
  };

  const handleVideoDialogClose = () => {
    setVideoDialogOpen(false);
    setSelectedVideoGroup(null);
  };

  const [relatedDialogOpen, setRelatedDialogOpen] = useState(false);
  const [relatedFrames, setRelatedFrames] = useState<{ image: ImageItem; clusterName: string }[]>([]);
  
  // Feedback handler - toggle selection
  const handleFeedback = (imageId: string, feedbackType: 'positive' | 'negative') => {
    const currentStatus = feedbackMap.get(imageId);
    
    // Toggle logic: if same type clicked again, remove selection
    if (currentStatus === feedbackType) {
      onFeedbackChange(imageId, null); // Remove selection
    } else {
      onFeedbackChange(imageId, feedbackType); // Set or change selection
    }
  };
  
  // Function to group images by video
  const groupImagesByVideo = (images: { image: ImageItem; clusterName: string }[]): VideoGroup[] => {
    const videoMap = new Map<string, VideoGroup>();
    
    images.forEach(({ image }) => {
      const videoId = image.videoId || 'unknown';
      const videoName = image.videoName || `Video ${videoId}`;
      
      if (!videoMap.has(videoId)) {
        videoMap.set(videoId, {
          videoId,
          videoName,
          frames: []
        });
      }
      
      videoMap.get(videoId)!.frames.push(image);
    });
    
    // Sort frames within each video by frame number or time
    // videoMap.forEach(group => {
    //   group.frames.sort((a, b) => {
    //     if (a.frameNumber && b.frameNumber) {
    //       return a.frameNumber - b.frameNumber;
    //     }
    //     if (a.time && b.time) {
    //       return a.time.localeCompare(b.time);
    //     }
    //     return 0;
    //   });
    // });
    
    return Array.from(videoMap.values());
  };

// A new component to display the time
const ImageTimeDisplay: React.FC<{ image: ImageItem; clusterName: string }> = ({ image, clusterName }) => {
  const [timeInfo, setTimeInfo] = useState<{ ms?: number; display: string }>({ display: "Loading..." });

  useEffect(() => {
    const frameNumber = (image as any).frameNumber;
    let isMounted = true; // Prevent state update on unmounted component

    const fetchTime = async () => {
      if (frameNumber === undefined || frameNumber === null) {
        setTimeInfo({ display: "Unknown" });
        return;
      }

      const ms = await frameToMs(clusterName || '', frameNumber);

      if (isMounted) {
        if (ms === null) {
          setTimeInfo({ display: "Unknown" });
        } else {
          const seconds = ms / 1000;
          const minutes = Math.floor(seconds / 60);
          const remainingSeconds = seconds - minutes * 60;
          const display = `${String(minutes).padStart(2, '0')}:${remainingSeconds.toFixed(3)}`;
          setTimeInfo({ ms, display });
        }
      }
    };

    fetchTime();

    return () => {
      isMounted = false; // Cleanup function
    };
  }, [image, clusterName]); // Rerun when image or cluster changes

  return (
    <Typography variant="h6" color="text.secondary">
      Time: {timeInfo.ms !== undefined ? `${timeInfo.ms} ` : ''}({timeInfo.display})
    </Typography>
  );
};

  useEffect(() => {
    console.log("=== CLUSTER LIST UPDATE ===");
    console.log("Mode:", mode);
    console.log("Clusters count:", clusters.length);
    console.log("Clusters:", clusters);
    
    if (mode === "moment") {
      Promise.all(
        clusters.map(async (c) => {
          const urls = await getListClusterImages(c);
          return urls.map((imagePath: string, index: number) => {
            const meta = (c.image_list && c.image_list[index]) || {} as any;
            // prefer meta.id/name for stable id if present
            const rawId = (meta.id || meta.name || imagePath.split('/').pop() || index).toString().replace(/^\/+/, '');
            const imageObj: any = {
              id: `${rawId}`,
              path: imagePath,
            };
            if (meta.name) imageObj.name = meta.name;
            if (meta.time_in_seconds !== undefined) imageObj.time = meta.time_in_seconds;
            else if (meta.time) imageObj.time = meta.time;
            if (meta.score !== undefined) imageObj.score = meta.score;
            return {
              image: imageObj,
              clusterName: c.cluster_name,
            };
          });
        })
      ).then((results) => {
        const flatImages = results.flat();

        // Enhance images with video information
        const enhancedImages = enhanceImagesWithVideoInfo(flatImages);
        setAllImages(enhancedImages);

        // Group by video (not used in moment view, but keep for consistency)
        const grouped = groupImagesByVideo(enhancedImages);
        setVideoGroups(grouped);
      });
    }

    if (mode === "video") {
      // Build video groups directly from cluster results so cluster_name is preserved
      Promise.all(
        clusters.map(async (c, ci) => {
          const urls = await getListClusterImages(c);
          const frames = (c.image_list || []).map((img, idx) => {
            const rawId = (img.id || "").replace(/^\/+/, "");
            const parts = rawId.split("/");
            const last = parts[parts.length - 1] || "";
            const frameNumber = last.match(/^(\d+)$/) ? parseInt(last, 10) : undefined;
            return {
              id: rawId || `${c.cluster_name}/${idx}`,
              path: urls[idx] || `${img.path}${img.id}`,
              name: img.name,
              time: (img as any).time_in_seconds || (img as any).time || undefined,
              score: (img as any).score || undefined,
              frameNumber,
            } as ImageItem;
          });

          return {
            videoId: c.cluster_name || `unknown_${ci}`,
            videoName: c.cluster_name || `Unknown Video`,
            frames,
          } as VideoGroup;
        })
      ).then((groups) => {
        setVideoGroups(groups);
        // also set allImages as flattened frames for consistency
        const flat = groups.flatMap((g) => g.frames.map((f) => ({ image: f, clusterName: g.videoName })));
        setAllImages(flat);
      });
    }
  }, [clusters, mode]);

  if (!clusters.length) {
    return (
      <div style={{ textAlign: "center", color: "#888" }}>
        No results found.
      </div>
    );
  }

  if (mode === "moment") {
    return (
      <>
        <ListWrapper
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
            gap: 20,
            padding: 16,
          }}
        >
          {allImages.map(({ image, clusterName }, idx) => (
            <ImageCard
              key={`${image.id}-${idx}`}
              src={image.path}
              alt={image.id}
              onClick={() => handleImageClick(image, clusterName)}
              info={image.id}
              ratio="16 / 9"
              showFeedback={!!stateId}
              feedbackStatus={feedbackMap.get(image.id) || null}
              onFeedback={(type) => handleFeedback(image.id, type)}
            />
          ))}
        </ListWrapper>

        {/* Nearby frames dialog (from related API) */}
        <Dialog
          open={relatedDialogOpen}
          onClose={() => setRelatedDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Nearby frames</span>
            <IconButton aria-label="close-related" onClick={() => setRelatedDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
                gap: 2,
                padding: 1,
              }}
            >
              {relatedFrames.map((rf, idx) => (
                <ImageCard
                  key={`related-${rf.clusterName}-${rf.image.id}-${idx}`}
                  src={rf.image.path}
                  alt={rf.image.id}
                  onClick={() => {
                    setSelectedImage({ image: rf.image, clusterName: rf.clusterName });
                    setRelatedDialogOpen(false);
                    setOpen(true);
                  }}
                  info={rf.image.frameNumber ? `${rf.image.frameNumber}` : rf.image.id}
                  ratio="16 / 9"
                />
              ))}
            </Box>
          </DialogContent>
        </Dialog>

        {/* Image modal for moment mode */}
        <Modal open={open} onClose={handleClose}>
          <Box
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              bgcolor: "background.paper",
              borderRadius: 3,
              boxShadow: 24,
              p: 3,
              width: '70vw',
              maxWidth: '1200px',
              maxHeight: '100vh',
              outline: "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              overflow: "hidden",
            }}
          >
            <IconButton
              onClick={handleClose}
              sx={{ position: "absolute", top: 8, right: 8, zIndex: 10 }}
              aria-label="close"
            >
              <CloseIcon />
            </IconButton>

            {selectedImage && (
              <>
                {/* Main image with navigation arrows */}
                <Box sx={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                  {/* Left arrow */}
                  <IconButton
                    onClick={handlePrevImage}
                    disabled={currentIndex === 0}
                    sx={{
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      bgcolor: 'rgba(0, 0, 0, 0.5)',
                      color: 'white',
                      '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.7)' },
                      '&.Mui-disabled': { bgcolor: 'rgba(0, 0, 0, 0.2)', color: 'rgba(255, 255, 255, 0.3)' },
                      zIndex: 2,
                    }}
                    aria-label="previous"
                  >
                    <ChevronLeftIcon fontSize="large" />
                  </IconButton>

                  {/* Main Image */}
                  <ImageCard
                    src={selectedImage.image.path}
                    alt={selectedImage.image.id}
                    sx={{ width: '70%', maxHeight: '60vh' }}
                    ratio="16 / 9"
                  />

                  {/* Right arrow */}
                  <IconButton
                    onClick={handleNextImage}
                    disabled={currentIndex === navigableImages.length - 1}
                    sx={{
                      position: 'absolute',
                      right: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      bgcolor: 'rgba(0, 0, 0, 0.5)',
                      color: 'white',
                      '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.7)' },
                      '&.Mui-disabled': { bgcolor: 'rgba(0, 0, 0, 0.2)', color: 'rgba(255, 255, 255, 0.3)' },
                      zIndex: 2,
                    }}
                    aria-label="next"
                  >
                    <ChevronRightIcon fontSize="large" />
                  </IconButton>
                </Box>

                {/* Image info */}
                {/* <Typography variant="h5" gutterBottom>
                  {selectedImage.clusterName}
                </Typography> */}
                <Typography variant="h6" color="text.secondary">
                  ID: {selectedImage.image.id}
                </Typography>
                {/* Show computed time (uses explicit time or derived from frameNumber/fps) */}
                {selectedImage && (
                  <ImageTimeDisplay 
                    image={selectedImage.image} 
                    clusterName={selectedImage.clusterName} 
                  />
                )}

                {/* Filmstrip preview */}
                {navigableImages.length > 1 && (
                  <Box
                    ref={filmstripRef}
                    sx={{
                      width: '100%',
                      overflowX: 'auto',
                      overflowY: 'hidden',
                      mt: 2,
                      mb: 2,
                      display: 'flex',
                      gap: 1,
                      p: 1,
                      bgcolor: 'rgba(0, 0, 0, 0.05)',
                      borderRadius: 2,
                      scrollBehavior: 'smooth',
                      '&::-webkit-scrollbar': {
                        height: 8,
                      },
                      '&::-webkit-scrollbar-track': {
                        bgcolor: 'rgba(0, 0, 0, 0.1)',
                        borderRadius: 2,
                      },
                      '&::-webkit-scrollbar-thumb': {
                        bgcolor: 'rgba(0, 0, 0, 0.3)',
                        borderRadius: 2,
                        '&:hover': {
                          bgcolor: 'rgba(0, 0, 0, 0.5)',
                        },
                      },
                    }}
                  >
                    {navigableImages.map((item, idx) => (
                      <Box
                        key={`thumb-${item.image.id}-${idx}`}
                        onClick={() => handleThumbnailClick(idx)}
                        sx={{
                          minWidth: 110,
                          maxWidth: 110,
                          cursor: 'pointer',
                          border: idx === currentIndex ? '3px solid' : '2px solid transparent',
                          borderColor: idx === currentIndex ? 'primary.main' : 'transparent',
                          borderRadius: 1,
                          overflow: 'hidden',
                          transition: 'all 0.2s ease',
                          opacity: idx === currentIndex ? 1 : 0.6,
                          '&:hover': {
                            opacity: 1,
                            transform: 'scale(1.05)',
                          },
                        }}
                      >
                        <img
                          src={item.image.path}
                          alt={item.image.id}
                          style={{
                            width: '100%',
                            height: '65px',
                            objectFit: 'cover',
                            display: 'block',
                          }}
                        />
                      </Box>
                    ))}
                  </Box>
                )}

                <Box sx={{ display: 'flex', width: '100%', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
                  <IconButton
                    onClick={async () => {
                      if (!selectedImage || isOpeningVideo) return;

                      setIsOpeningVideo(true); // Set loading state to true

                      try {
                        const clusterUrl = (selectedImage.image as any).clusterUrl;
                        const clusterName = selectedImage.clusterName;
                        const frameNumber = (selectedImage.image as any).frameNumber;
                        
                        let seconds: number | undefined;

                        // Check if we can derive time from the frame number
                        if (frameNumber !== undefined && frameNumber !== null) {
                          // Await the promise to get the actual value
                          const ms = await frameToMs(clusterName, frameNumber);
                          if (ms !== null) {
                            seconds = ms / 1000;
                          }
                        }
                        
                        // Construct the URL
                        const timeParam = seconds !== undefined ? seconds.toFixed(3) : '';
                        const base = clusterUrl || `${BASE_IMAGE_URL}/data/videos/${clusterName}.mp4`;
                        const href = timeParam ? `${base}#t=${timeParam}` : base;
                        
                        window.open(href, "_blank");

                      } catch (error) {
                        console.error("Failed to calculate time and open video:", error);
                        // Optionally, show an error message to the user
                      } finally {
                        setIsOpeningVideo(false); // Always reset loading state
                      }
                    }}
                    aria-label="open-video"
                    color="primary"
                    disabled={isOpeningVideo} // Disable the button while loading
                  >
                    <OpenInNewIcon />
                  </IconButton>
                  <IconButton onClick={handleNextFrame} aria-label="next-frame" color="primary">
                    <ArrowForwardIcon />
                  </IconButton>
                </Box>
              </>
            )}
          </Box>
        </Modal>
      </>
    );
  }

  if (mode === "video") {
    return (
      <>
        <ListWrapper style={{ padding: 16 }}>
          {videoGroups.map((videoGroup) => (
            <Box key={videoGroup.videoId} sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
                {videoGroup.videoName}
                <Typography variant="body2" color="text.secondary" component="span" sx={{ ml: 2 }}>
                  ({videoGroup.frames.length} frames)
                </Typography>
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                  gap: 2,
                  padding: 1,
                  backgroundColor: 'background.default',
                  borderRadius: 2,
                  position: 'relative',
                }}
              >
                {videoGroup.frames.slice(0, 9).map((frame, idx) => (
                  <ImageCard
                    key={`${videoGroup.videoId}-${frame.id}-${idx}`}
                    src={frame.path}
                    alt={frame.id}
                    onClick={() => handleImageClick(frame, videoGroup.videoName)}
                    // I want info show this style: 001234
                    info={frame.frameNumber ? `${String(frame.frameNumber).padStart(6, '0')}` : String(frame.id).padStart(6, '0')}
                    ratio="16 / 9"
                    showFeedback={!!stateId}
                    feedbackStatus={feedbackMap.get(frame.id) || null}
                    onFeedback={(type) => handleFeedback(frame.id, type)}
                  />
                ))}
                {videoGroup.frames.length > 9 && (
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 64,
                      right: 68,
                    }}
                  >
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<ViewModuleIcon />}
                      onClick={() => handleVideoExpand(videoGroup)}
                      sx={{
                        backgroundColor: 'primary.main',
                        '&:hover': {
                          backgroundColor: 'primary.dark',
                        },
                      }}
                    >
                      View All ({videoGroup.frames.length})
                    </Button>
                  </Box>
                )}
              </Box>
            </Box>
          ))}
        </ListWrapper>

        <Dialog
          open={relatedDialogOpen}
          onClose={() => setRelatedDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Nearby frames</span>
            <IconButton aria-label="close-related" onClick={() => setRelatedDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
                gap: 2,
                padding: 1,
              }}
            >
              {relatedFrames.map((rf, idx) => (
                <ImageCard
                  key={`related-${rf.clusterName}-${rf.image.id}-${idx}`}
                  src={rf.image.path}
                  alt={rf.image.id}
                  onClick={() => {
                    setSelectedImage({ image: rf.image, clusterName: rf.clusterName });
                    setRelatedDialogOpen(false);
                    setOpen(true);
                  }}
                  info={rf.image.id}
                  ratio="16 / 9"
                />
              ))}
            </Box>
          </DialogContent>
        </Dialog>

        {/* Regular image modal for video mode */}
        <Modal open={open} onClose={handleClose}>
          <Box
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              bgcolor: "background.paper",
              borderRadius: 3,
              boxShadow: 24,
              p: 3,
              width: '70vw',
              maxWidth: '1200px',
              maxHeight: '100vh',
              outline: "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              overflow: "hidden",
            }}
          >
            <IconButton
              onClick={handleClose}
              sx={{ position: "absolute", top: 8, right: 8, zIndex: 10 }}
              aria-label="close"
            >
              <CloseIcon />
            </IconButton>
          
            {selectedImage && (
              <>
                {/* Main image with navigation arrows */}
                <Box sx={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                  {/* Left arrow */}
                  <IconButton
                    onClick={handlePrevImage}
                    disabled={currentIndex === 0}
                    sx={{
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      bgcolor: 'rgba(0, 0, 0, 0.5)',
                      color: 'white',
                      '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.7)' },
                      '&.Mui-disabled': { bgcolor: 'rgba(0, 0, 0, 0.2)', color: 'rgba(255, 255, 255, 0.3)' },
                      zIndex: 2,
                    }}
                    aria-label="previous"
                  >
                    <ChevronLeftIcon fontSize="large" />
                  </IconButton>

                  {/* Main Image */}
                  <ImageCard
                    src={selectedImage.image.path}
                    alt={selectedImage.image.id}
                    sx={{ width: '70%', maxHeight: '60vh' }}
                    ratio="16 / 9"
                  />

                  {/* Right arrow */}
                  <IconButton
                    onClick={handleNextImage}
                    disabled={currentIndex === navigableImages.length - 1}
                    sx={{
                      position: 'absolute',
                      right: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      bgcolor: 'rgba(0, 0, 0, 0.5)',
                      color: 'white',
                      '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.7)' },
                      '&.Mui-disabled': { bgcolor: 'rgba(0, 0, 0, 0.2)', color: 'rgba(255, 255, 255, 0.3)' },
                      zIndex: 2,
                    }}
                    aria-label="next"
                  >
                    <ChevronRightIcon fontSize="large" />
                  </IconButton>
                </Box>

                {/* Image info */}
                {/* <Typography variant="h5" gutterBottom>
                  {selectedImage.clusterName}
                </Typography> */}
                <Typography variant="h6" color="text.secondary">
                  ID: {selectedImage.image.id}
                </Typography>
                {selectedImage && (
                  <ImageTimeDisplay 
                    image={selectedImage.image} 
                    clusterName={selectedImage.clusterName} 
                  />
                )}

                {/* Filmstrip preview */}
                {navigableImages.length > 1 && (
                  <Box
                    ref={filmstripRef}
                    sx={{
                      width: '100%',
                      overflowX: 'auto',
                      overflowY: 'hidden',
                      mt: 2,
                      mb: 2,
                      display: 'flex',
                      gap: 1,
                      p: 1,
                      bgcolor: 'rgba(0, 0, 0, 0.05)',
                      borderRadius: 2,
                      scrollBehavior: 'smooth',
                      '&::-webkit-scrollbar': {
                        height: 8,
                      },
                      '&::-webkit-scrollbar-track': {
                        bgcolor: 'rgba(0, 0, 0, 0.1)',
                        borderRadius: 2,
                      },
                      '&::-webkit-scrollbar-thumb': {
                        bgcolor: 'rgba(0, 0, 0, 0.3)',
                        borderRadius: 2,
                        '&:hover': {
                          bgcolor: 'rgba(0, 0, 0, 0.5)',
                        },
                      },
                    }}
                  >
                    {navigableImages.map((item, idx) => (
                      <Box
                        key={`thumb-${item.image.id}-${idx}`}
                        onClick={() => handleThumbnailClick(idx)}
                        sx={{
                          minWidth: 110,
                          maxWidth: 110,
                          cursor: 'pointer',
                          border: idx === currentIndex ? '3px solid' : '2px solid transparent',
                          borderColor: idx === currentIndex ? 'primary.main' : 'transparent',
                          borderRadius: 1,
                          overflow: 'hidden',
                          transition: 'all 0.2s ease',
                          opacity: idx === currentIndex ? 1 : 0.6,
                          '&:hover': {
                            opacity: 1,
                            transform: 'scale(1.05)',
                          },
                        }}
                      >
                        <img
                          src={item.image.path}
                          alt={item.image.id}
                          style={{
                            width: '100%',
                            height: '65px',
                            objectFit: 'cover',
                            display: 'block',
                          }}
                        />
                      </Box>
                    ))}
                  </Box>
                )}

                <Box sx={{ display: 'flex', width: '100%', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
                  <IconButton
                    onClick={async () => {
                      if (!selectedImage || isOpeningVideo) return;

                      setIsOpeningVideo(true); // Set loading state to true

                      try {
                        const clusterUrl = (selectedImage.image as any).clusterUrl;
                        const clusterName = selectedImage.clusterName;
                        const frameNumber = (selectedImage.image as any).frameNumber;
                        
                        let seconds: number | undefined;

                        // Check if we can derive time from the frame number
                        if (frameNumber !== undefined && frameNumber !== null) {
                          // Await the promise to get the actual value
                          const ms = await frameToMs(clusterName, frameNumber);
                          if (ms !== null) {
                            seconds = ms / 1000;
                          }
                        }
                        
                        // Construct the URL
                        const timeParam = seconds !== undefined ? seconds.toFixed(3) : '';
                        const base = clusterUrl || `${BASE_IMAGE_URL}/data/videos/${clusterName}.mp4`;
                        const href = timeParam ? `${base}#t=${timeParam}` : base;
                        
                        window.open(href, "_blank");

                      } catch (error) {
                        console.error("Failed to calculate time and open video:", error);
                        // Optionally, show an error message to the user
                      } finally {
                        setIsOpeningVideo(false); // Always reset loading state
                      }
                    }}
                    aria-label="open-video"
                    color="primary"
                    disabled={isOpeningVideo} // Disable the button while loading
                  >
                    <OpenInNewIcon />
                  </IconButton>
                  <IconButton onClick={handleNextFrame} aria-label="next-frame" color="primary">
                    <ArrowForwardIcon />
                  </IconButton>
                </Box>
              </>
            )}
          </Box>
        </Modal>

        {/* Video Dialog for showing all frames */}
        <Dialog
          open={videoDialogOpen}
          onClose={handleVideoDialogClose}
          maxWidth="lg"
          fullWidth
          PaperProps={{
            sx: {
              minHeight: '80vh',
              maxHeight: '90vh',
            },
          }}
        >
          <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              {selectedVideoGroup?.videoName} - All Frames ({selectedVideoGroup?.frames.length})
            </Typography>
            <IconButton onClick={handleVideoDialogClose} aria-label="close">
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
                gap: 2,
                padding: 1,
              }}
            >
              {selectedVideoGroup?.frames.map((frame, idx) => (
                <ImageCard
                  key={`dialog-${selectedVideoGroup.videoId}-${frame.id}-${idx}`}
                  src={frame.path}
                  alt={frame.id}
                  onClick={() => handleImageClick(frame, selectedVideoGroup.videoName)}
                  info={frame.frameNumber ? `${frame.frameNumber}` : frame.id}
                  ratio="16 / 9"
                  showFeedback={!!stateId}
                  feedbackStatus={feedbackMap.get(frame.id) || null}
                  onFeedback={(type) => handleFeedback(frame.id, type)}
                />
              ))}
            </Box>
          </DialogContent>
        </Dialog>
        {/* Related frames dialog shown after calling /search/related */}
        <Dialog
          open={relatedDialogOpen}
          onClose={() => setRelatedDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Nearby frames</span>
            <IconButton aria-label="close-related" onClick={() => setRelatedDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
                gap: 2,
                padding: 1,
              }}
            >
              {relatedFrames.map((rf, idx) => (
                <ImageCard
                  key={`related-${rf.clusterName}-${rf.image.id}-${idx}`}
                  src={rf.image.path}
                  alt={rf.image.id}
                  onClick={() => {
                    const cluster = clusters.find((c) => c.cluster_name === rf.clusterName);
                    const imageWithUrl = { ...(rf.image as any), clusterUrl: cluster?.url } as ImageItem & { clusterUrl?: string };
                    setSelectedImage({ image: imageWithUrl, clusterName: rf.clusterName });
                    setRelatedDialogOpen(false);
                    setOpen(true);
                  }}
                  info={rf.image.frameNumber ? `${rf.image.frameNumber}` : rf.image.id}
                  ratio="16 / 9"
                />
              ))}
            </Box>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Default: cluster view
  return (
    <ListWrapper>
      {clusters.map((c, idx) => (
        <ClusterCard key={idx} cluster={c} mode={mode} />
      ))}
    </ListWrapper>
  );
};

export default ClusterList;
