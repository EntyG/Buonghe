import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ClusterResult, ImageItem } from '../../types';
import {
  ResultsGrid,
  ResultImage,
} from '../../App.chatbot.styles';
import { Box, Typography, IconButton, Chip } from '@mui/material';
import ThumbUpAltOutlinedIcon from '@mui/icons-material/ThumbUpAltOutlined';
import ThumbDownAltOutlinedIcon from '@mui/icons-material/ThumbDownAltOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

interface ChatResultsGridProps {
  results: ClusterResult[];
  mode: string;
  compact?: boolean;
  initialMaxImages?: number;  // Initial max images to show (default 8)
  imagesPerExpand?: number;   // How many more images to show each time (default 8)
  searchType?: string; // 'text' | 'temporal' | 'visual' etc.
  onImageClick?: (item: ImageItem, imageUrl?: string) => void;
  onFeedback?: (imageId: string, type: 'positive' | 'negative' | null) => void;
  feedbackMap?: Map<string, 'positive' | 'negative'>;
}

const ChatResultsGrid: React.FC<ChatResultsGridProps> = ({
  results,
  mode,
  compact = false,
  initialMaxImages = 8,
  imagesPerExpand = 8,
  searchType,
  onImageClick,
  onFeedback,
  feedbackMap = new Map(),
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const [itemsPerRow, setItemsPerRow] = useState(8); // Default 8 per row
  const [maxVisible, setMaxVisible] = useState(initialMaxImages); // Current max visible images
  const [visibleScenes, setVisibleScenes] = useState(3); // For temporal view

  // Check if this is a temporal search (scenes with before/now/after)
  const isTemporal = searchType === 'TEMPORAL' || searchType === 'temporal';

  // Calculate items per row based on grid width
  useEffect(() => {
    const calculateItemsPerRow = () => {
      if (gridRef.current) {
        const gridWidth = gridRef.current.offsetWidth - 24; // Subtract padding
        const minItemWidth = 140;
        const gap = 8;
        const calculatedItems = Math.floor((gridWidth + gap) / (minItemWidth + gap));
        setItemsPerRow(Math.max(1, calculatedItems));
      }
    };

    calculateItemsPerRow();
    window.addEventListener('resize', calculateItemsPerRow);
    return () => window.removeEventListener('resize', calculateItemsPerRow);
  }, []);


  // For temporal: each cluster is a scene with before/now/after
  // For regular: flatten all images, and use getListClusterImages to get URLs
  const allImages: { item: ImageItem; clusterName: string; imageUrl: string }[] = useMemo(() => {
    let arr: { item: ImageItem; clusterName: string; imageUrl: string }[] = [];
    results.forEach((cluster) => {
      // Use getListClusterImages to get URLs for this cluster
      // getListClusterImages is async, but image_list is small and sync for local usage
      // So we use the sync logic here for now
      const urls = cluster.image_list.map((img) => {
        const BASE_IMAGE_URL = process.env.REACT_APP_BASE_IMAGE_URL || 'http://14.225.217.119:8081';
        return `${BASE_IMAGE_URL}${img.path}`;
      });
      cluster.image_list.forEach((item, idx) => {
        arr.push({ item, clusterName: cluster.cluster_name, imageUrl: urls[idx] });
      });
    });
    return arr;
  }, [results]);

  // Calculate visible images: starts at initialMaxImages, increases by imagesPerExpand each click
  const displayImages = allImages.slice(0, maxVisible);
  const remainingCount = allImages.length - displayImages.length;
  const hasMore = remainingCount > 0;

  // For temporal view
  const displayScenes = useMemo(() => results.slice(0, visibleScenes), [results, visibleScenes]);
  const remainingScenes = results.length - displayScenes.length;
  const hasMoreScenes = remainingScenes > 0;

  const handleShowMore = () => {
    setMaxVisible(prev => prev + imagesPerExpand);
  };

  const handleShowMoreScenes = () => {
    setVisibleScenes(prev => prev + 2);
  };

  if (displayImages.length === 0) {
    return (
      <Box sx={{ 
        p: 2, 
        textAlign: 'center', 
        color: 'text.secondary',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: 2,
        mt: 1.5
      }}>
        <Typography variant="body2">No results found</Typography>
      </Box>
    );
  }

  // Temporal view: Display as scenes with before → now → after
  if (isTemporal) {
    return (
      <Box sx={{ mt: 1.5 }}>
        {displayScenes.map((scene, sceneIndex) => (
          <Box
            key={scene.cluster_name}
            sx={{
              mb: 2,
              p: 1.5,
              bgcolor: 'rgba(0,0,0,0.3)',
              borderRadius: 2,
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            {/* Scene header */}
            <Typography 
              variant="caption" 
              sx={{ 
                color: 'primary.main', 
                fontWeight: 600,
                display: 'block',
                mb: 1,
              }}
            >
              {scene.cluster_name}
            </Typography>
            
            {/* Before → Now → After sequence */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflowX: 'auto' }}>
              {scene.image_list.map((item, idx) => {
                // Use getListClusterImages logic for each image
                const BASE_IMAGE_URL = process.env.REACT_APP_BASE_IMAGE_URL || 'http://14.225.217.119:8081';
                const imageUrl = item.path.startsWith('http') ? item.path : `${BASE_IMAGE_URL}${item.path}`;
                const feedback = feedbackMap.get(item.id);
                const labels = ['Before', 'Now', 'After'];
                const label = labels[idx] || item.name;
                const isNow = idx === 1;
                
                return (
                  <React.Fragment key={item.id}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 160 }}>
                      {/* Label */}
                      <Chip
                        label={label}
                        size="small"
                        sx={{
                          mb: 0.5,
                          bgcolor: isNow ? 'primary.main' : 'rgba(255,255,255,0.1)',
                          color: isNow ? 'white' : 'text.secondary',
                          fontWeight: isNow ? 700 : 400,
                          fontSize: '0.7rem',
                        }}
                      />
                      {/* Image */}
                      <ResultImage
                        onClick={() => onImageClick?.(item, imageUrl)}
                        style={{
                          width: 160,
                          height: 90,
                          border: feedback
                            ? `2px solid ${feedback === 'positive' ? '#4ade80' : '#f87171'}`
                            : isNow ? '2px solid var(--primary)' : '2px solid transparent',
                        }}
                      >
                        <img src={imageUrl} alt={item.name || item.id} loading="lazy" />
                        <div className="overlay">
                          {item.time_in_seconds !== undefined && (
                            <div style={{ fontSize: '0.65rem' }}>
                              {Math.floor(item.time_in_seconds / 60)}:{String(Math.floor(item.time_in_seconds % 60)).padStart(2, '0')}
                            </div>
                          )}
                        </div>
                      </ResultImage>
                    </Box>
                    {/* Arrow between frames */}
                    {idx < scene.image_list.length - 1 && (
                      <ArrowForwardIcon sx={{ color: 'text.secondary', fontSize: 20, flexShrink: 0 }} />
                    )}
                  </React.Fragment>
                );
              })}
            </Box>
            
            {/* Movie info */}
            {scene.image_list[0]?.videoName && (
              <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
                📽️ {scene.image_list[0].videoName}
              </Typography>
            )}
          </Box>
        ))}
        
        {hasMoreScenes && (
          <Box 
            onClick={handleShowMoreScenes}
            sx={{ 
              textAlign: 'center', 
              mt: 1,
              py: 0.75,
              color: 'primary.main',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: 'pointer',
              borderRadius: 1,
              transition: 'all 0.2s',
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.05)',
                textDecoration: 'underline',
              }
            }}
          >
            +{remainingScenes} more scenes
          </Box>
        )}
      </Box>
    );
  }

  // Regular grid view
  return (
    <Box sx={{ mt: 1.5 }}>
      <ResultsGrid ref={gridRef}>
        {displayImages.map(({ item, clusterName, imageUrl }, index) => {
          const feedback = feedbackMap.get(item.id);
          return (
            <ResultImage 
              key={`${item.id}-${index}`}
              onClick={() => onImageClick?.(item, imageUrl)}
              style={{
                border: feedback 
                  ? `2px solid ${feedback === 'positive' ? '#4ade80' : '#f87171'}`
                  : '2px solid transparent'
              }}
            >
              <img 
                src={imageUrl} 
                alt={item.name || item.id}
                loading="lazy"
              />
              <div className="overlay">
                <div>{item.name || item.id.split('/').pop()}</div>
                {item.time_in_seconds !== undefined && (
                  <div style={{ fontSize: '0.65rem', opacity: 0.8 }}>
                    {Math.floor(item.time_in_seconds / 60)}:{String(Math.floor(item.time_in_seconds % 60)).padStart(2, '0')}
                  </div>
                )}
              </div>
              
              {/* Feedback buttons on hover */}
              {onFeedback && (
                <Box
                  className="feedback-buttons"
                  sx={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    display: 'flex',
                    gap: 0.5,
                    opacity: 0,
                    transition: 'opacity 0.2s',
                    '.parent:hover &': { opacity: 1 },
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onFeedback(item.id, feedback === 'positive' ? null : 'positive');
                    }}
                    sx={{
                      bgcolor: feedback === 'positive' ? '#4ade80' : 'rgba(0,0,0,0.6)',
                      color: '#fff',
                      '&:hover': { bgcolor: '#4ade80' },
                      width: 24,
                      height: 24,
                    }}
                  >
                    <ThumbUpAltOutlinedIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onFeedback(item.id, feedback === 'negative' ? null : 'negative');
                    }}
                    sx={{
                      bgcolor: feedback === 'negative' ? '#f87171' : 'rgba(0,0,0,0.6)',
                      color: '#fff',
                      '&:hover': { bgcolor: '#f87171' },
                      width: 24,
                      height: 24,
                    }}
                  >
                    <ThumbDownAltOutlinedIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
              )}
            </ResultImage>
          );
        })}
      </ResultsGrid>
      
      {hasMore && (
        <Box 
          onClick={handleShowMore}
          sx={{ 
            textAlign: 'center', 
            mt: 1,
            py: 0.75,
            color: 'primary.main',
            fontSize: '0.85rem',
            fontWeight: 500,
            cursor: 'pointer',
            borderRadius: 1,
            transition: 'all 0.2s',
            '&:hover': {
              bgcolor: 'rgba(255,255,255,0.05)',
              textDecoration: 'underline',
            }
          }}
        >
          +{remainingCount} more results
        </Box>
      )}
    </Box>
  );
};

export default ChatResultsGrid;
