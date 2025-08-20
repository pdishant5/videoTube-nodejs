import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.models.js";
import { Video } from "../models/video.models.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js";

const getAllVideos = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 10,
        query = "",
        sortBy = "createdAt",
        sortType = "desc",
        userId
    } = req.query;
    //TODO: get all videos based on query, sort, pagination

    const filters = {};

    if (query) {
        filters.$or = [
            {
                title: {
                    $regex: query, $options: "i"
                }
            },
            {
                description: {
                    $regex: query, $options: "i"
                }
            }
        ];
    }
    if (userId) {
        filters.owner = new mongoose.Types.ObjectId(String(userId));
    }

    const sortOrder = sortType === "asc" ? 1 : -1;

    const videos = await Video.find(filters)
        .populate("owner")
        .sort({ [sortBy]: sortOrder })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit));
    
    const totalVideos = await Video.countDocuments(filters);

    return res
        .status(200)
        .json(new ApiResponse(
            200,
            {
                videoData: videos,
                pagination: {
                    currentPage: Number(page),
                    limit: Number(limit),
                    totalVideos: totalVideos,
                    totalPages: Math.ceil(totalVideos / parseFloat(limit))
                }
            },
            "Videos fetched successfully!"
        ));
});

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body;
    // TODO: get video, upload to cloudinary, create video

    if (!title?.trim() || !description?.trim()) {
        throw new ApiError(400, "Title and description are required!");
    }
    if (!req.user || !req.user._id) {
        throw new ApiError(401, "Unauthorized!");
    }

    const videoLocalPath = req.files?.video?.[0]?.path;
    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;
    
    if (!videoLocalPath) {
        throw new ApiError(400, "Video is missing!");
    }

    let video;
    try {
        video = await uploadOnCloudinary(videoLocalPath);
        console.log("Video uploaded!");
    } catch (error) {
        console.log("Error uploading video!");
        throw new ApiError(500, "Failed to upload video!");
    }

    let thumbnail;
    try {
        thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
        console.log("Thumbnail uploaded!");
    } catch (error) {
        console.log("Error uploading thumbnail!");
        throw new ApiError(500, "Failed to upload thumbnail!");
    }

    try {
        const newVideo = await Video.create({
            videoFile: video.url,
            thumbnail: thumbnail?.url || "",
            title,
            description,
            duration: video.duration,
            views: 0,
            isPublished: true,
            owner: new mongoose.Types.ObjectId(String(req.user._id))
        });

        const createdVideo = await Video.findById(newVideo._id);
            
        if (!createdVideo) {
            throw new ApiError(500, "Something went wrong while publishing the video!");
        }

        return res.status(201).json(new ApiResponse(201, createdVideo, "Video published successfully!"));
    } catch (error) {
        console.log("Video creation failed!");

        if (video) {
            await deleteFromCloudinary(video.public_id);
        }
        if (thumbnail) {
            await deleteFromCloudinary(thumbnail.public_id);
        }
        throw new ApiError(500, "Something went wrong while publishing the video and video was deleted!");
    }
});

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    //TODO: get video by id

    if (!videoId) {
        throw new ApiError(400, "Video ID is required!");
    }

    const video = await Video.findById(videoId).populate("owner");

    if (!video || !video.isPublished) {
        throw new ApiError(404, "Video not found!");
    }

    return res.status(200).json(new ApiResponse(200, video, "Video found!"));
});

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    //TODO: update video details like title, description, thumbnail

    if (!videoId) {
        throw new ApiError(400, "Video ID is required!");
    }

    const thumbnailLocalPath = req.file?.path;
    if (!thumbnailLocalPath) {
        throw new ApiError(400, "Thumbnail is required!");
    }

    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
    if (!thumbnail.url) {
        throw new ApiError(500, "Something went wrong while updating thumbnail!");
    }

    try {
        const updatedVideo = await Video.findByIdAndUpdate(
            videoId,
            {
                $set: {
                    thumbnail: thumbnail.url
                }
            },
            { new: true }
        ).populate("owner");
    
        return res.status(200).json(new ApiResponse(200, updatedVideo, "Video updated successfully!"));
    } catch (error) {
        console.log("Failed to update the video!");
        
        if (thumbnail) {
            await deleteFromCloudinary(thumbnail.public_id);
        }
        throw new ApiError(500, "Something went wrong while updating the video and new thumbnail was deleted!");
    }
});

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    //TODO: delete video

    if (!videoId) {
        throw new ApiError(400, "Video ID is required!");
    }

    const deletedVideo = await Video.findByIdAndDelete(videoId);

    const videoURL = deletedVideo.videoFile;
    const thumbnailURL = deletedVideo.thumbnail;

    const videoPublicId = videoURL.match(/[^/.]+(?=\.[^.]+$)/);
    const thumbnailPublicId = thumbnailURL?.match(/[^/.]+(?=\.[^.]+$)/);

    if (videoPublicId && videoPublicId[0]) {
        deleteFromCloudinary(videoPublicId[0]);
    }
    if (thumbnailPublicId && thumbnailPublicId[0]) {
        deleteFromCloudinary(videoPublicId[0]);
    }
    return res.status(200).json(new ApiResponse(200, deletedVideo, "Video deleted successfully!"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!videoId) {
        throw new ApiError(400, "Video ID is required!");
    }

    const video = await Video.findById(videoId);

    video.isPublished = !video.isPublished;
    await video.save({ validateBeforeSave: false });

    return res.status(200).json(new ApiResponse(200, video, "Video status updated successfully!"));
});

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
};