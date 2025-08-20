import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.models.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleVideoLike = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    //TODO: toggle like on video

    if (!videoId) {
        throw new ApiError(400, "Video ID is required!");
    }
    
    const like = await Like.findOne({
        video: new mongoose.Types.ObjectId(String(videoId)),
        likedBy: new mongoose.Types.ObjectId(String(req.user._id))
    });

    if (!like) {
        const newLike = await Like.create({
            video: new mongoose.Types.ObjectId(String(videoId)),
            likedBy: new mongoose.Types.ObjectId(String(req.user._id))
        });

        const createdLike = await Like.findById(newLike._id).populate("likedBy");
        if (!createdLike) {
            return new ApiError(500, "Something went wrong while liking video!");
        }

        return res.status(201).json(new ApiResponse(201, createdLike, "Like created successfully!"));
    } else {
        const deletedLike = await Like.findOneAndDelete({
            video: new mongoose.Types.ObjectId(String(videoId)),
            likedBy: new mongoose.Types.ObjectId(String(req.user._id))
        });

        return res.status(200).json(new ApiResponse(200, deletedLike, "Like deleted successfully!"));
    }
});

const toggleCommentLike = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    //TODO: toggle like on comment

    if (!commentId) {
        throw new ApiError(400, "Comment ID is required!");
    }
    
    const like = await Like.findOne({
        comment: new mongoose.Types.ObjectId(String(commentId)),
        likedBy: new mongoose.Types.ObjectId(String(req.user._id))
    });

    if (!like) {
        const newLike = await Like.create({
            comment: new mongoose.Types.ObjectId(String(commentId)),
            likedBy: new mongoose.Types.ObjectId(String(req.user._id))
        });

        const createdLike = await Like.findById(newLike._id).populate("likedBy");
        if (!createdLike) {
            return new ApiError(500, "Something went wrong while liking comment!");
        }

        return res.status(201).json(new ApiResponse(201, createdLike, "Like created successfully!"));
    } else {
        const deletedLike = await Like.findOneAndDelete({
            comment: new mongoose.Types.ObjectId(String(commentId)),
            likedBy: new mongoose.Types.ObjectId(String(req.user._id))
        });

        return res.status(200).json(new ApiResponse(200, deletedLike, "Like deleted successfully!"));
    }
});

const toggleTweetLike = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;
    //TODO: toggle like on tweet

    if (!tweetId) {
        throw new ApiError(400, "Tweet ID is required!");
    }
    
    const like = await Like.findOne({
        tweet: new mongoose.Types.ObjectId(String(tweetId)),
        likedBy: new mongoose.Types.ObjectId(String(req.user._id))
    });

    if (!like) {
        const newLike = await Like.create({
            tweet: new mongoose.Types.ObjectId(String(tweetId)),
            likedBy: new mongoose.Types.ObjectId(String(req.user._id))
        });

        const createdLike = await Like.findById(newLike._id).populate("likedBy");
        if (!createdLike) {
            return new ApiError(500, "Something went wrong while liking tweet!");
        }

        return res.status(201).json(new ApiResponse(201, createdLike, "Like created successfully!"));
    } else {
        const deletedLike = await Like.findOneAndDelete({
            tweet: new mongoose.Types.ObjectId(String(tweetId)),
            likedBy: new mongoose.Types.ObjectId(String(req.user._id))
        });

        return res.status(200).json(new ApiResponse(200, deletedLike, "Like deleted successfully!"));
    }
});

const getLikedVideos = asyncHandler(async (req, res) => {
    //TODO: get all liked videos
    const likedVideos = await Like.find({
        likedBy: new mongoose.Types.ObjectId(String(req.user._id)),
        video: { $ne: null }
    }).populate("video");

    if (likedVideos.length === 0) {
        throw new ApiError(404, "No liked videos found!");
    }

    return res.status(200).json(new ApiResponse(200, likedVideos, "Liked videos fetched successfully!"));
});

export {
    toggleVideoLike,
    toggleCommentLike,
    toggleTweetLike,
    getLikedVideos
};