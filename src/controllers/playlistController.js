import mongoose, { isValidObjectId, mongo } from "mongoose";
import { Playlist } from "../models/playlist.models.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { application } from "express";

const createPlaylist = asyncHandler(async (req, res) => {
    const { name, description } = req.body;
    //TODO: create playlist

    if (!name?.trim() || !description?.trim()) {
        throw new ApiError(400, "Name and description are required!");
    }

    const playlist = await Playlist.create({
        name: name.trim(),
        description: description.trim(),
        videos: [],
        owner: new mongoose.Types.ObjectId(String(req.user._id))
    });

    const createdPlaylist = await Playlist.findById(playlist._id).populate("owner");
    if (!createdPlaylist) {
        return new ApiError(500, "Something went wrong while creating playlist!");
    }

    return res.status(201).json(new ApiResponse(201, createdPlaylist, "Playlist created successfully!"));
});

const getUserPlaylists = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    //TODO: get user playlists

    if (!userId) {
        throw new ApiError(400, "User ID is required!");
    }

    const playlists = await Playlist.find({ owner: new mongoose.Types.ObjectId(String(userId)) });

    if (playlists.length === 0) {
        throw new ApiError(400, "No playlists found!");
    }

    return res.status(200).json(new ApiResponse(200, playlists, "Playlists fetched successfully!"));
});

const getPlaylistById = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;
    //TODO: get playlist by id

    if (!playlistId) {
        throw new ApiError(400, "Playlist ID is required!");
    }
    
    const playlist = await Playlist.findById(new mongoose.Types.ObjectId(String(playlistId))).populate("owner");
    
    if (!playlist) {
        throw new ApiError(404, "Playlist not found!");
    }
    
    return res.status(200).json(new ApiResponse(200, playlist, "Playlist fetched successfully!"));
});

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const { videoId, playlistId } = req.params;
    
    if (!videoId || !playlistId) {
        throw new ApiError(400, "Video ID and Playlist ID are required!");
    }
    
    const playlist = await Playlist.findById(new mongoose.Types.ObjectId(String(playlistId))).populate("owner");
    if (!playlist) {
        throw new ApiError(404, "Playlist not found!");
    }
    
    playlist.videos.push(new mongoose.Types.ObjectId(String(videoId)));
    await playlist.save({ validateBeforeSave: false });
    
    return res.status(200).json(new ApiResponse(200, playlist, "Video added to the playlist successfully!"));
});

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const { videoId, playlistId } = req.params;
    // TODO: remove video from playlist
    
    if (!videoId || !playlistId) {
        throw new ApiError(400, "Video ID and Playlist ID are required!");
    }
    
    const playlist = await Playlist.findById(new mongoose.Types.ObjectId(String(playlistId))).populate("owner");
    if (!playlist) {
        throw new ApiError(404, "Playlist not found!");
    }
    
    playlist.videos = playlist.videos.filter(video => video._id != videoId);
    await playlist.save({ validateBeforeSave: false });
    
    return res.status(200).json(new ApiResponse(200, playlist, "Video removed from the playlist successfully!"));
});

const deletePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;
    // TODO: delete playlist
    
    if (!playlistId) {
        throw new ApiError(400, "Playlist ID is required!");
    }
    
    const deletedPlaylist = await Playlist.findByIdAndDelete(playlistId);
    if (!deletedPlaylist) {
        throw new ApiError(404, "Playlist not found!");
    }

    return res.status(200).json(new ApiResponse(200, deletedPlaylist, "Playlist deleted successfully!"));
});

const updatePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;
    const { name, description } = req.body;
    //TODO: update playlist

    if (!playlistId) {
        throw new ApiError(400, "Playlist ID is required!");
    }
    if (!name?.trim() || !description?.trim()) {
        throw new ApiError(400, "Name and description are required!");
    }

    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $set: {
                name: name.trim(),
                description: description.trim()
            }
        },
        { new: true }
    ).populate("owner");

    if (!updatedPlaylist) {
        throw new ApiError(500, "Something went wrong while updating the playlist!");
    }

    return res.status(200).json(new ApiResponse(200, updatedPlaylist, "Playlist updated successfully!"));
});

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
};