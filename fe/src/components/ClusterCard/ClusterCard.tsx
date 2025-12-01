import React, { useEffect, useState } from "react";
import { CardContent, Typography, Modal, Box, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { ClusterResult } from "../../types";
import { StyledCard, ImagesRow, ImageThumb } from "./ClusterCard.styles";
import { getListClusterImages } from "../../api";
import Grid from "@mui/material/Grid";
import ImageCard from "../ImageCard/ImageCard";

interface Props {
  cluster: ClusterResult;
  mode: string;
}

const ClusterCard: React.FC<Props> = ({ cluster, mode }) => {
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [openPopup, setOpenPopup] = useState(false);
  const [openCloser, setOpenCloser] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{
    url: string;
    idx: number;
  } | null>(null);

  useEffect(() => {
    const fetchImages = async () => {
      try {
        const urls = await getListClusterImages(cluster);
        setImageUrls(urls);
      } catch (error) {
        console.error("Error fetching images:", error);
      }
    };
    fetchImages();
  }, [cluster]);

  // Mở popup khi click card (chỉ cho mode video)
  const handleCardClick = () => {
    if (mode === "video") setOpenPopup(true);
  };

  // Mở closer view khi click ảnh trong popup
  const handleImageClick = (url: string, idx: number) => {
    setSelectedImage({ url, idx });
    setOpenCloser(true);
  };

  return (
    <>
      <StyledCard
        onClick={handleCardClick}
        sx={
          mode === "video"
            ? {
                cursor: "pointer",
                transition: "box-shadow 0.2s",
                "&:hover": { boxShadow: 6 },
              }
            : {}
        }
      >
        <CardContent>
          <Typography variant="h6" color="primary" gutterBottom>
            {cluster.cluster_name}
          </Typography>
          {mode === "video" && cluster.image_list[0]?.time && (
            <Typography variant="body2" color="textSecondary">
              Thời gian: {cluster.image_list[0].time}
            </Typography>
          )}
          <ImagesRow>
            {imageUrls.map((url, index) => (
              <ImageThumb key={index} src={url} alt={`image-${index}`} />
            ))}
          </ImagesRow>
        </CardContent>
      </StyledCard>

      {/* Popup hiển thị toàn bộ ảnh */}
      <Modal open={openPopup} onClose={() => setOpenPopup(false)}>
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
            minWidth: 340,
            maxWidth: 600,
            outline: "none",
          }}
        >
          <IconButton
            onClick={() => setOpenPopup(false)}
            sx={{ position: "absolute", top: 8, right: 8 }}
            aria-label="close"
          >
            <CloseIcon />
          </IconButton>
          <Typography variant="h6" gutterBottom textAlign="center">
            {cluster.cluster_name}
          </Typography>
          <Grid container spacing={2} justifyContent="center">
            {imageUrls.map((url, idx) => (
              <Grid size={{ xs: 6, sm: 4, md: 3 }} key={idx}>
                <ImageCard
                  src={url}
                  alt={`image-${idx}`}
                  onClick={() => handleImageClick(url, idx)}
                  sx={{ width: "100%" }}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      </Modal>

      {/* Closer view modal */}
      <Modal open={openCloser} onClose={() => setOpenCloser(false)}>
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
            minWidth: 320,
            maxWidth: 400,
            outline: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <IconButton
            onClick={() => setOpenCloser(false)}
            sx={{ position: "absolute", top: 8, right: 8 }}
            aria-label="close"
          >
            <CloseIcon />
          </IconButton>
          {selectedImage && (
            <>
              <ImageCard
                src={selectedImage.url}
                alt={`image-${selectedImage.idx}`}
                sx={{ width: 240, height: 240 }}
                style={{ marginBottom: 16 }}
              />
              <Typography variant="h6" gutterBottom>
                {cluster.cluster_name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ID: {cluster.image_list[selectedImage.idx]?.id}
              </Typography>
              {cluster.image_list[selectedImage.idx]?.time && (
                <Typography variant="body2" color="text.secondary">
                  Time: {cluster.image_list[selectedImage.idx]?.time}
                </Typography>
              )}
            </>
          )}
        </Box>
      </Modal>
    </>
  );
};

export default ClusterCard;
